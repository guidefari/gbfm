import { REMINDER_STATUS } from '@gbfm/core/status'
import { and, asc, eq, lte, or } from 'drizzle-orm'
import { Chunk, Effect, Schedule } from 'effect'
import { Database } from '@/db/layer'
import { musicReminder } from '@/db/music-reminder.schema'
import { getErrorMessage, ReminderProcessingError } from '@/errors'
import { sendMusicReminderEmailEffect } from './email.service'

// Process all pending music reminders
export const processPendingReminders = Effect.gen(function* () {
  const db = yield* Database
  const now = new Date()
  const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000)

  // Atomically claim pending reminders (or stalled ones)
  const claimedReminders = yield* Effect.tryPromise({
    try: () =>
      db
        .update(musicReminder)
        .set({
          status: REMINDER_STATUS.PROCESSING,
          updatedAt: new Date()
        })
        .where(
          and(
            lte(musicReminder.reminderDate, now),
            or(
              eq(musicReminder.status, REMINDER_STATUS.PENDING),
              and(
                eq(musicReminder.status, REMINDER_STATUS.PROCESSING),
                lte(musicReminder.updatedAt, fiveMinutesAgo)
              ),
              eq(musicReminder.status, REMINDER_STATUS.FAILED)
            )
          )
        )
        .returning(),
    catch: (error) =>
      new ReminderProcessingError({
        message: `Failed to claim pending reminders: ${getErrorMessage(error)}`,
        reminderId: 'batch',
        stage: 'query'
      })
  })

  if (claimedReminders.length === 0) {
    yield* Effect.logInfo('No pending reminders to process')
    return
  }

  yield* Effect.logInfo(`Processing ${claimedReminders.length} claimed reminders`)

  // Process reminders in batches with concurrency control
  yield* Effect.forEach(
    Chunk.fromIterable(claimedReminders),
    (reminder) =>
      processSingleReminder(reminder).pipe(
        Effect.retry(Schedule.exponential(1000).pipe(Schedule.upTo({ duration: '30 seconds' }))),
        Effect.catch((error) =>
          Effect.logError(
            `Failed to process reminder ${reminder.id} after retries: ${
              error instanceof Error ? error.message : String(error)
            }`
          )
        )
      ),
    { concurrency: 3 }
  )
})

const processSingleReminder = (reminder: typeof musicReminder.$inferSelect) =>
  Effect.gen(function* () {
    const db = yield* Database
    // Send the reminder email
    yield* sendMusicReminderEmailEffect(reminder)

    // Mark reminder as sent
    yield* Effect.tryPromise({
      try: () =>
        db
          .update(musicReminder)
          .set({
            status: REMINDER_STATUS.SENT,
            isSent: true,
            updatedAt: new Date()
          })
          .where(eq(musicReminder.id, reminder.id)),
      catch: (error) =>
        new ReminderProcessingError({
          message: `Failed to update reminder status to sent: ${getErrorMessage(error)}`,
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
    Effect.catch((error) =>
      Effect.gen(function* () {
        const db = yield* Database
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
                status: REMINDER_STATUS.FAILED,
                updatedAt: new Date()
              })
              .where(eq(musicReminder.id, reminder.id)),
          catch: () => undefined // ignore update failure in error handler
        }).pipe(Effect.ignore)

        return yield* error
      })
    )
  )

// Returns the soonest reminderDate among pending/failed reminders (past or future)
export const queryNextDueReminder = Effect.gen(function* () {
  const db = yield* Database
  const results = yield* Effect.tryPromise({
    try: () =>
      db
        .select({ reminderDate: musicReminder.reminderDate })
        .from(musicReminder)
        .where(
          or(
            eq(musicReminder.status, REMINDER_STATUS.PENDING),
            eq(musicReminder.status, REMINDER_STATUS.FAILED)
          )
        )
        .orderBy(asc(musicReminder.reminderDate))
        .limit(1),
    catch: (error) =>
      new ReminderProcessingError({
        message: `Failed to query next due reminder: ${getErrorMessage(error)}`,
        reminderId: 'next-query',
        stage: 'query'
      })
  })

  return results[0]?.reminderDate ?? null
})

// Get statistics about pending reminders (for monitoring)
// not using this anywhere yet👀
export const getReminderStats = Effect.gen(function* () {
  const db = yield* Database
  const now = new Date()

  const [stats] = yield* Effect.tryPromise({
    try: () =>
      db
        .select({
          totalPending: db.$count(
            musicReminder,
            or(
              eq(musicReminder.status, REMINDER_STATUS.PENDING),
              eq(musicReminder.status, REMINDER_STATUS.FAILED)
            )
          ),
          dueNow: db.$count(
            musicReminder,
            and(
              lte(musicReminder.reminderDate, now),
              or(
                eq(musicReminder.status, REMINDER_STATUS.PENDING),
                eq(musicReminder.status, REMINDER_STATUS.FAILED)
              )
            )
          ),
          processing: db.$count(musicReminder, eq(musicReminder.status, REMINDER_STATUS.PROCESSING))
        })
        .from(musicReminder),
    catch: (error) =>
      new ReminderProcessingError({
        message: `Failed to get reminder stats: ${getErrorMessage(error)}`,
        reminderId: 'stats',
        stage: 'query'
      })
  })

  return {
    totalPending: stats?.totalPending || 0,
    dueNow: stats?.dueNow || 0,
    timestamp: now.toISOString()
  }
})
