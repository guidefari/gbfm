import { eq } from 'drizzle-orm'
import { Chunk, Effect, Schedule } from 'effect'
import { db } from '@/db'
import { musicReminder } from '@/db/music-reminder.schema'
import { ReminderProcessingError } from '@/errors'
import { sendMusicReminderEmailEffect } from './email.service'

// Process all pending music reminders
export const processPendingReminders = Effect.gen(function* () {
  // Query pending reminders (reminderDate <= now AND isSent = false)
  const pendingReminders = yield* Effect.tryPromise({
    try: () =>
      db
        .select()
        .from(musicReminder)
        .where(eq(musicReminder.isSent, false))
        .orderBy(musicReminder.reminderDate),
    catch: (error) =>
      new ReminderProcessingError({
        message: `Failed to query pending reminders: ${(error as Error).message}`,
        reminderId: 'batch',
        stage: 'query'
      })
  })

  // Filter reminders that are due (reminderDate <= now)
  const now = new Date()
  const dueReminders = pendingReminders.filter(
    (reminder) => reminder.reminderDate <= now
  )

  if (dueReminders.length === 0) {
    yield* Effect.logInfo('No pending reminders to process')
    return
  }

  yield* Effect.logInfo(`Processing ${dueReminders.length} due reminders`)

  // Process reminders in batches with concurrency control
  yield* Effect.forEach(
    Chunk.fromIterable(dueReminders),
    (reminder) =>
      processSingleReminder(reminder).pipe(
        Effect.retry(
          Schedule.exponential(1000).pipe(Schedule.upTo('30 seconds'))
        ),
        Effect.catchAll((error) =>
          Effect.logError(
            `Failed to process reminder ${reminder.id}: ${error.message}`
          )
        )
      ),
    { concurrency: 3 } // Process 3 reminders concurrently
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
            .set({ isSent: true })
            .where(eq(musicReminder.id, reminder.id)),
        catch: (error) =>
          new ReminderProcessingError({
            message: `Failed to update reminder status: ${(error as Error).message}`,
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
      // Log the failure but don't re-throw - we want to continue processing other reminders
      yield* Effect.logError(`Failed to send reminder ${reminder.id}`, {
        error: error instanceof Error ? error.message : 'Unknown error',
        reminderId: reminder.id,
        musicTitle: reminder.musicTitle
      })

      // Don't mark as sent if email failed - will be retried on next run
      return yield* Effect.fail(error as Error)
    }
  })

// Get statistics about pending reminders (for monitoring)
export const getReminderStats = Effect.gen(function* () {
  const now = new Date()

  const [stats] = yield* Effect.tryPromise({
    try: () =>
      db
        .select({
          totalPending: db.$count(musicReminder),
          dueNow: db.$count(musicReminder, eq(musicReminder.isSent, false))
        })
        .from(musicReminder)
        .where(eq(musicReminder.isSent, false)),
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
