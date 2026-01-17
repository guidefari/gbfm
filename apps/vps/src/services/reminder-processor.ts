import { and, eq, lte, or } from 'drizzle-orm'
import { Chunk, Effect, Schedule } from 'effect'
import { db } from '@/db'
import { musicReminder } from '@/db/music-reminder.schema'
import { ReminderProcessingError } from '@/errors'
import { sendMusicReminderEmailEffect } from './email.service'

// Process all pending music reminders
export const processPendingReminders = Effect.gen(function* () {
  const now = new Date()
  const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000)

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

  if (claimedReminders.length === 0) {
    yield* Effect.logInfo('No pending reminders to process')
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
        Effect.catchAll((error) =>
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

// Process a single reminder
const processSingleReminder = (reminder: typeof musicReminder.$inferSelect) =>
  Effect.gen(function* () {
    try {
      // Send the reminder email
      yield* sendMusicReminderEmailEffect(reminder)

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
    } catch (error) {
      // Log the failure
      yield* Effect.logError(`Failed to send reminder ${reminder.id}`, {
        error: error instanceof Error ? error.message : 'Unknown error',
        reminderId: reminder.id,
        musicTitle: reminder.musicTitle
      })

      // Mark as failed so it can be picked up later (or retry immediately if we want)
      yield* Effect.tryPromise({
        try: () =>
          db
            .update(musicReminder)
            .set({
              status: 'failed',
              updatedAt: new Date()
            })
            .where(eq(musicReminder.id, reminder.id)),
        catch: () => {
          /* ignore update failure in error handler */
        }
      })

      return yield* Effect.fail(error as Error)
    }
  })

// Get statistics about pending reminders (for monitoring)
// not using this anywhere yet👀
export const getReminderStats = Effect.gen(function* () {
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

  return {
    totalPending: stats?.totalPending || 0,
    dueNow: stats?.dueNow || 0,
    timestamp: now.toISOString()
  }
})
