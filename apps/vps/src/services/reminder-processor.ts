import { and, eq, lte, or } from 'drizzle-orm'
import { Chunk, Effect, Schedule } from 'effect'
import { db } from '@/db'
import { musicReminder } from '@/db/music-reminder.schema'
import { ReminderProcessingError } from '@/errors'
import { recordEmailSend, recordJobExecution } from '@/lib/metrics'
import { withServiceSpan } from '@/lib/tracing'
import { sendMusicReminderEmailEffect } from './email.service'

// Process all pending music reminders
export const processPendingReminders = withServiceSpan(
  'reminder',
  'processPending',
  {}
)(
  Effect.gen(function* () {
    const jobStart = performance.now()
    const now = new Date()
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000)

    let processedCount = 0
    let failedCount = 0

    // Atomically claim pending reminders (or stalled ones)
    const claimedReminders = yield* Effect.tryPromise({
      try: () =>
        db
          .update(musicReminder)
          .set({
            status: 'processing',
            updatedAt: new Date()
          })
          .where(
            and(
              lte(musicReminder.reminderDate, now),
              or(
                eq(musicReminder.status, 'pending'),
                and(
                  eq(musicReminder.status, 'processing'),
                  lte(musicReminder.updatedAt, fiveMinutesAgo)
                ),
                eq(musicReminder.status, 'failed')
              )
            )
          )
          .returning(),
      catch: (error) =>
        new ReminderProcessingError({
          message: `Failed to claim pending reminders: ${(error as Error).message}`,
          reminderId: 'batch',
          stage: 'query'
        })
    })

    yield* Effect.annotateCurrentSpan('reminders.claimed', claimedReminders.length)

    if (claimedReminders.length === 0) {
      yield* Effect.logInfo('No pending reminders to process')

      // Get queue depth for metrics
      const queueDepth = yield* getQueueDepth
      yield* recordJobExecution(
        'reminder-processor',
        performance.now() - jobStart,
        0,
        0,
        queueDepth
      )
      return
    }

    yield* Effect.logInfo(
      `Processing ${claimedReminders.length} claimed reminders`
    )

    // Process reminders in batches with concurrency control
    yield* Effect.forEach(
      Chunk.fromIterable(claimedReminders),
      (reminder) =>
        processSingleReminder(reminder).pipe(
          Effect.retry(
            Schedule.exponential(1000).pipe(Schedule.upTo('30 seconds'))
          ),
          Effect.tap(() =>
            Effect.sync(() => {
              processedCount++
            })
          ),
          Effect.catchAll((error) => {
            failedCount++
            return Effect.logError(
              `Failed to process reminder ${reminder.id} after retries: ${
                error instanceof Error ? error.message : String(error)
              }`
            )
          })
        ),
      { concurrency: 3 }
    )

    // Record job metrics
    const queueDepth = yield* getQueueDepth
    yield* recordJobExecution(
      'reminder-processor',
      performance.now() - jobStart,
      processedCount,
      failedCount,
      queueDepth
    )

    yield* Effect.annotateCurrentSpan('reminders.processed', processedCount)
    yield* Effect.annotateCurrentSpan('reminders.failed', failedCount)
  })
)

// Helper to get current queue depth
const getQueueDepth = Effect.tryPromise({
  try: async () => {
    const [result] = await db
      .select({
        count: db.$count(
          musicReminder,
          or(
            eq(musicReminder.status, 'pending'),
            eq(musicReminder.status, 'failed')
          )
        )
      })
      .from(musicReminder)
    return result?.count ?? 0
  },
  catch: () => 0
}).pipe(Effect.orElse(() => Effect.succeed(0)))

const processSingleReminder = (reminder: typeof musicReminder.$inferSelect) =>
  withServiceSpan('reminder', 'processSingle', {
    reminderId: reminder.id,
    musicTitle: reminder.musicTitle
  })(
    Effect.gen(function* () {
      // Send the reminder email with metrics
      const emailStart = performance.now()
      yield* sendMusicReminderEmailEffect(reminder)
      yield* recordEmailSend(
        'music-reminder',
        performance.now() - emailStart,
        false
      )

      // Mark reminder as sent
      yield* Effect.tryPromise({
        try: () =>
          db
            .update(musicReminder)
            .set({
              status: 'sent',
              isSent: true,
              updatedAt: new Date()
            })
            .where(eq(musicReminder.id, reminder.id)),
        catch: (error) =>
          new ReminderProcessingError({
            message: `Failed to update reminder status to sent: ${(error as Error).message}`,
            reminderId: reminder.id,
            stage: 'update'
          })
      })

      yield* Effect.logInfo(`Successfully processed reminder`, {
        reminderId: reminder.id,
        musicTitle: reminder.musicTitle,
        artistName: reminder.artistName
      })
    }).pipe(
      Effect.catchAll((error) =>
        Effect.gen(function* () {
          // Record failed email metric
          yield* recordEmailSend('music-reminder', 0, true)

          // Log the failure
          yield* Effect.logError(`Failed to send reminder ${reminder.id}`, {
            error: error instanceof Error ? error.message : 'Unknown error',
            reminderId: reminder.id,
            musicTitle: reminder.musicTitle
          })

          // Mark as failed so it can be picked up later
          yield* Effect.tryPromise({
            try: () =>
              db
                .update(musicReminder)
                .set({
                  status: 'failed',
                  updatedAt: new Date()
                })
                .where(eq(musicReminder.id, reminder.id)),
            catch: () => undefined // ignore update failure in error handler
          }).pipe(Effect.ignore)

          return yield* error
        })
      )
    )
  )

// Get statistics about pending reminders (for monitoring)
export const getReminderStats = withServiceSpan('reminder', 'getStats', {})(
  Effect.gen(function* () {
    const now = new Date()

    const [stats] = yield* Effect.tryPromise({
      try: () =>
        db
          .select({
            totalPending: db.$count(
              musicReminder,
              or(
                eq(musicReminder.status, 'pending'),
                eq(musicReminder.status, 'failed')
              )
            ),
            dueNow: db.$count(
              musicReminder,
              and(
                lte(musicReminder.reminderDate, now),
                or(
                  eq(musicReminder.status, 'pending'),
                  eq(musicReminder.status, 'failed')
                )
              )
            ),
            processing: db.$count(
              musicReminder,
              eq(musicReminder.status, 'processing')
            )
          })
          .from(musicReminder),
      catch: (error) =>
        new ReminderProcessingError({
          message: `Failed to get reminder stats: ${(error as Error).message}`,
          reminderId: 'stats',
          stage: 'query'
        })
    })

    yield* Effect.annotateCurrentSpan('stats.totalPending', stats?.totalPending || 0)
    yield* Effect.annotateCurrentSpan('stats.dueNow', stats?.dueNow || 0)

    return {
      totalPending: stats?.totalPending || 0,
      dueNow: stats?.dueNow || 0,
      processing: stats?.processing || 0,
      timestamp: now.toISOString()
    }
  })
)
