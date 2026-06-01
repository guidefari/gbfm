import { EMAIL_DELIVERY_STATUSES } from '@gbfm/core/status'
import { sendMusicReminderEmail } from '@gbfm/email/sender'
import { eq } from 'drizzle-orm'
import { Context, Effect, Layer } from 'effect'
import { db } from '@/db'
import { user } from '@/db/auth.schema'
import { EMAIL_NOTIFICATION_TYPES, emailDeliveryLogsTable } from '@/db/email.schema'
import type { MusicReminder } from '@/db/music-reminder.schema'
import { DatabaseError, EmailError, getErrorMessage } from '@/errors'
import { recordEmailFail, recordEmailSend } from '@/lib/performance-monitoring'

// Service interface
export interface EmailService {
  sendMusicReminderEmail: (
    reminder: MusicReminder
  ) => Effect.Effect<void, EmailError | DatabaseError>
}

// Service tag for dependency injection
export const EmailService = Context.Service<EmailService>('EmailService')

// Implementation
export const EmailServiceLive = Layer.effect(
  EmailService,
  Effect.gen(function* () {
    return {
      sendMusicReminderEmail: (reminder: MusicReminder) => sendReminderEmail(reminder)
    }
  })
)

// Core email sending logic with Effect
const sendReminderEmail = (reminder: MusicReminder) =>
  Effect.gen(function* () {
    yield* Effect.annotateCurrentSpan('email.type', 'music_reminder')
    yield* Effect.annotateCurrentSpan('reminder.id', reminder.id)
    yield* Effect.annotateCurrentSpan('user.id', reminder.userId)

    // Get user email address
    const userRecords = yield* Effect.tryPromise({
      try: () =>
        db.select({ email: user.email }).from(user).where(eq(user.id, reminder.userId)).limit(1),
      catch: (error) =>
        new DatabaseError({
          message: `Failed to fetch user email: ${getErrorMessage(error)}`,
          operation: 'select',
          table: 'users'
        })
    })

    if (userRecords.length === 0) {
      return yield* new EmailError({
        message: `User not found for reminder ${reminder.id}`,
        reminderId: reminder.id
      })
    }

    const userRecord = userRecords[0]

    if (!userRecord?.email) {
      return yield* new EmailError({
        message: `User email not found for reminder ${reminder.id}`,
        reminderId: reminder.id
      })
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
            emailType: EMAIL_NOTIFICATION_TYPES.MIX_RELEASE,
            templateName: 'music-reminder',
            subject: `🎵 Time to listen: ${reminder.musicTitle} by ${reminder.artistName}`,
            status: EMAIL_DELIVERY_STATUSES.PENDING,
            metadata: {
              reminderId: reminder.id,
              musicTitle: reminder.musicTitle,
              artistName: reminder.artistName
            }
          })
          .returning({ id: emailDeliveryLogsTable.id }),
      catch: (error) =>
        new DatabaseError({
          message: `Failed to create email log: ${getErrorMessage(error)}`,
          operation: 'insert',
          table: 'email_delivery_logs'
        })
    })

    if (logEntries.length === 0) {
      return yield* new EmailError({
        message: `Failed to create email log entry`,
        reminderId: reminder.id
      })
    }

    const logEntry = logEntries[0]

    if (!logEntry?.id) {
      return yield* new DatabaseError({
        message: `Failed to create email log entry`,
        operation: 'insert',
        table: 'email_delivery_logs'
      })
    }

    // Send the actual email and handle success/failure with Effect composition
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
          message: `Failed to send email: ${getErrorMessage(error)}`,
          reminderId: reminder.id,
          emailAddress: userEmail
        })
    }).pipe(
      Effect.andThen(() =>
        // Update log on success
        Effect.tryPromise({
          try: () =>
            db
              .update(emailDeliveryLogsTable)
              .set({
                status: EMAIL_DELIVERY_STATUSES.SENT,
                sentAt: new Date()
              })
              .where(eq(emailDeliveryLogsTable.id, logEntry.id)),
          catch: (error) =>
            new DatabaseError({
              message: `Failed to update email log: ${getErrorMessage(error)}`,
              operation: 'update',
              table: 'email_delivery_logs'
            })
        })
      ),
      Effect.andThen(() => recordEmailSend()),
      Effect.andThen(() =>
        Effect.logInfo(`Successfully sent music reminder email`, {
          reminderId: reminder.id,
          email: userEmail,
          musicTitle: reminder.musicTitle
        })
      ),
      Effect.catch((sendError) => {
        // Update log on failure
        const errorMessage = sendError instanceof EmailError ? sendError.message : 'Unknown error'

        return Effect.tryPromise({
          try: () =>
            db
              .update(emailDeliveryLogsTable)
              .set({
                status: EMAIL_DELIVERY_STATUSES.FAILED,
                errorMessage
              })
              .where(eq(emailDeliveryLogsTable.id, logEntry.id)),
          catch: (logError) =>
            new DatabaseError({
              message: `Failed to update email log on failure: ${getErrorMessage(logError)}`,
              operation: 'update',
              table: 'email_delivery_logs'
            })
        }).pipe(
          Effect.andThen(() => recordEmailFail()),
          Effect.andThen(() => Effect.fail(sendError))
        )
      })
    )
  })

// Main function to send music reminder emails
export const sendMusicReminderEmailEffect = (
  reminder: MusicReminder
): Effect.Effect<void, EmailError | DatabaseError> =>
  sendReminderEmail(reminder).pipe(
    Effect.withSpan('email.send', {
      attributes: {
        'email.template': 'music-reminder',
        'external.system': 'email'
      }
    })
  )
