import { sendMusicReminderEmail } from '@gbfm/email/sender'
import { eq } from 'drizzle-orm'
import { Context, Effect, Layer } from 'effect'
import { db } from '@/db'
import { user } from '@/db/auth.schema'
import { emailDeliveryLogsTable } from '@/db/email.schema'
import type { MusicReminder } from '@/db/music-reminder.schema'
import { DatabaseError, EmailError } from '@/errors'

// Service interface
export interface EmailService {
  sendMusicReminderEmail: (
    reminder: MusicReminder
  ) => Effect.Effect<void, EmailError | DatabaseError>
}

// Service tag for dependency injection
export const EmailService = Context.GenericTag<EmailService>('EmailService')

// Implementation
export const EmailServiceLive = Layer.effect(
  EmailService,
  Effect.gen(function* () {
    return {
      sendMusicReminderEmail: (reminder: MusicReminder) =>
        sendReminderEmail(reminder)
    }
  })
)

// Core email sending logic with Effect
const sendReminderEmail = (reminder: MusicReminder) =>
  Effect.gen(function* () {
    // Get user email address
    const userRecords = yield* Effect.tryPromise({
      try: () =>
        db
          .select({ email: user.email })
          .from(user)
          .where(eq(user.id, reminder.userId))
          .limit(1),
      catch: (error) =>
        new DatabaseError({
          message: `Failed to fetch user email: ${(error as Error).message}`,
          operation: 'select',
          table: 'users'
        })
    })

    if (userRecords.length === 0) {
      return yield* Effect.fail(
        new EmailError({
          message: `User not found for reminder ${reminder.id}`,
          reminderId: reminder.id
        })
      )
    }

    const userRecord = userRecords[0]

    if (!userRecord?.email) {
      return yield* Effect.fail(
        new EmailError({
          message: `User email not found for reminder ${reminder.id}`,
          reminderId: reminder.id
        })
      )
    }

    const userEmail = userRecord.email

    // Create email log entry
    const logEntries = yield* Effect.tryPromise({
      try: () =>
        db
          .insert(emailDeliveryLogsTable)
          .values({
            userId: reminder.userId,
            recipientEmail: userEmail,
            emailType: 'music_reminder',
            templateName: 'music-reminder',
            subject: `🎵 Time to listen: ${reminder.musicTitle} by ${reminder.artistName}`,
            status: 'pending',
            metadata: {
              reminderId: reminder.id,
              musicTitle: reminder.musicTitle,
              artistName: reminder.artistName
            }
          })
          .returning({ id: emailDeliveryLogsTable.id }),
      catch: (error) =>
        new DatabaseError({
          message: `Failed to create email log: ${(error as Error).message}`,
          operation: 'insert',
          table: 'email_delivery_logs'
        })
    })

    if (logEntries.length === 0) {
      return yield* Effect.fail(
        new EmailError({
          message: `Failed to create email log entry`,
          reminderId: reminder.id
        })
      )
    }

    const logEntry = logEntries[0]

    if (!logEntry?.id) {
      return yield* Effect.fail(
        new DatabaseError({
          message: `Failed to create email log entry`,
          operation: 'insert',
          table: 'email_delivery_logs'
        })
      )
    }

    try {
      // Send the actual email
      yield* Effect.tryPromise({
        try: () =>
          sendMusicReminderEmail({
            to: userEmail,
            username: userEmail.split('@')[0] || 'user',
            musicTitle: reminder.musicTitle,
            artistName: reminder.artistName,
            musicUrl: reminder.musicUrl,
            reminderDate: reminder.reminderDate.toISOString(),
            notes: reminder.notes || undefined,
            albumCoverUrl: reminder.albumCoverUrl || undefined
          }),
        catch: (error) =>
          new EmailError({
            message: `Failed to send email: ${(error as Error).message}`,
            reminderId: reminder.id,
            emailAddress: userEmail
          })
      })

      // Update log on success
      yield* Effect.tryPromise({
        try: () =>
          db
            .update(emailDeliveryLogsTable)
            .set({
              status: 'sent',
              sentAt: new Date()
            })
            .where(eq(emailDeliveryLogsTable.id, logEntry.id)),
        catch: (error) =>
          new DatabaseError({
            message: `Failed to update email log: ${(error as Error).message}`,
            operation: 'update',
            table: 'email_delivery_logs'
          })
      })

      yield* Effect.logInfo(`Successfully sent music reminder email`, {
        reminderId: reminder.id,
        email: userEmail,
        musicTitle: reminder.musicTitle
      })
    } catch (sendError: unknown) {
      // Update log on failure
      const errorMessage =
        sendError instanceof EmailError ? sendError.message : 'Unknown error'

      yield* Effect.tryPromise({
        try: () =>
          db
            .update(emailDeliveryLogsTable)
            .set({
              status: 'failed',
              errorMessage
            })
            .where(eq(emailDeliveryLogsTable.id, logEntry.id)),
        catch: (logError) =>
          new DatabaseError({
            message: `Failed to update email log on failure: ${(logError as Error).message}`,
            operation: 'update',
            table: 'email_delivery_logs'
          })
      })

      return yield* Effect.fail(sendError as EmailError)
    }
  })

// Main function to send music reminder emails
export const sendMusicReminderEmailEffect = (
  reminder: MusicReminder
): Effect.Effect<void, EmailError | DatabaseError> =>
  sendReminderEmail(reminder)
