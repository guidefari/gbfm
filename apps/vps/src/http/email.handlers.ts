import { Api } from '@gbfm/api/api'
import { type SendMixNotificationInput, type SendMixNotificationResponse } from '@gbfm/api/email'
import { AuthSession } from '@gbfm/api/middleware/auth'
import { EMAIL_DELIVERY_STATUSES, type EmailDeliveryStatus } from '@gbfm/core/status'
import { sendMixNotificationEmail } from '@gbfm/email/sender'
import { and, eq } from 'drizzle-orm'
import { Effect, Schema } from 'effect'
import { HttpApiBuilder, HttpApiError } from 'effect/unstable/httpapi'
import { db } from '@/db'
import { audioTable } from '@/db/audio.schema'
import { user as usersTable } from '@/db/auth.schema'
import {
  EMAIL_NOTIFICATION_TYPES,
  type EmailNotificationType,
  type SelectEmailDeliveryLog
} from '@/db/email.schema'
import { DatabaseError, getErrorMessage } from '@/errors'
import { dieOnDatabaseError as makeDieOnDatabaseError } from '@/http/handler-utils'
import {
  createEmailDeliveryLog,
  getAdminEmailLogs,
  markEmailDeliveryLogAsFailed,
  markEmailDeliveryLogAsSent
} from '@/repositories/email-delivery-log.repository'
import {
  canReceiveEmail,
  getActiveMixRecipients
} from '@/repositories/email-preferences.repository'
import { runAppFork } from '@/runtime'

const dieOnDatabaseError = makeDieOnDatabaseError('email')
const EmailMetadata = Schema.NullOr(Schema.Record(Schema.String, Schema.Unknown))

const EMAIL_TYPE_NORMALIZATION_MAP: Record<string, EmailNotificationType> = {
  TRANSACTIONAL: EMAIL_NOTIFICATION_TYPES.TRANSACTIONAL,
  MIX_RELEASE: EMAIL_NOTIFICATION_TYPES.MIX_RELEASE,
  MIXRELEASE: EMAIL_NOTIFICATION_TYPES.MIX_RELEASE,
  MIX_NOTIFICATION: EMAIL_NOTIFICATION_TYPES.MIX_RELEASE,
  MUSIC_REMINDER: EMAIL_NOTIFICATION_TYPES.MIX_RELEASE,
  PROMOTIONAL: EMAIL_NOTIFICATION_TYPES.PROMOTIONAL,
  SYSTEM: EMAIL_NOTIFICATION_TYPES.SYSTEM
}

const EMAIL_STATUS_NORMALIZATION_MAP: Record<string, EmailDeliveryStatus> = {
  PENDING: EMAIL_DELIVERY_STATUSES.PENDING,
  SENT: EMAIL_DELIVERY_STATUSES.SENT,
  DELIVERED: EMAIL_DELIVERY_STATUSES.DELIVERED,
  BOUNCED: EMAIL_DELIVERY_STATUSES.BOUNCED,
  COMPLAINED: EMAIL_DELIVERY_STATUSES.COMPLAINED,
  FAILED: EMAIL_DELIVERY_STATUSES.FAILED,
  SUCCESS: EMAIL_DELIVERY_STATUSES.SENT,
  FAILURE: EMAIL_DELIVERY_STATUSES.FAILED
}

class MixNotFoundError extends Error {
  readonly _tag = 'MixNotFoundError'
}

function normalizeLogToken(value: string | null | undefined) {
  return (value ?? '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

function toEmailLogResponse(log: SelectEmailDeliveryLog) {
  const normalizedTypeToken = normalizeLogToken(log.emailType)
  const normalizedStatusToken = normalizeLogToken(log.status)

  return {
    ...log,
    emailType: EMAIL_TYPE_NORMALIZATION_MAP[normalizedTypeToken] ?? EMAIL_NOTIFICATION_TYPES.SYSTEM,
    status: EMAIL_STATUS_NORMALIZATION_MAP[normalizedStatusToken] ?? EMAIL_DELIVERY_STATUSES.FAILED,
    metadata: Schema.decodeUnknownSync(EmailMetadata)(log.metadata),
    sentAt: log.sentAt?.toISOString() ?? null,
    deliveredAt: log.deliveredAt?.toISOString() ?? null,
    bouncedAt: log.bouncedAt?.toISOString() ?? null,
    complainedAt: log.complainedAt?.toISOString() ?? null,
    createdAt: log.createdAt.toISOString(),
    updatedAt: log.updatedAt.toISOString()
  }
}

async function sendMixNotification(
  input: SendMixNotificationInput
): Promise<SendMixNotificationResponse> {
  const recipients =
    input.recipients && input.recipients.length > 0
      ? input.recipients
      : await getActiveMixRecipients()

  if (recipients.length === 0) {
    return { success: true, sentTo: [], emailIds: [], message: 'No opted-in recipients' }
  }

  const mix = await db.query.audioTable.findFirst({
    where: and(
      eq(audioTable.slug, input.mixSlug),
      eq(audioTable.type, 'mix'),
      eq(audioTable.draft, false)
    ),
    with: {
      show: {
        columns: { thumbnailUrl: true }
      }
    }
  })

  if (!mix) {
    throw new MixNotFoundError(`Mix not found: ${input.mixSlug}`)
  }

  const mixThumbnailUrl = mix.thumbnailUrl ?? mix.show?.thumbnailUrl ?? null
  const mixUrl = `https://goosebumps.fm/mixes/${mix.slug}`
  const coverImageUrl = input.metadata?.coverImageUrl || mixThumbnailUrl || undefined
  const releaseDate =
    input.metadata?.releaseDate ||
    (mix.createdAt
      ? new Date(mix.createdAt).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        })
      : new Date().toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        }))

  const sentTo: string[] = []
  const skipped: string[] = []
  const errors: string[] = []
  const emailIds: string[] = []

  for (const recipient of recipients) {
    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.email, recipient))
      .limit(1)

    const username = user?.name || input.metadata?.username || recipient.split('@')[0] || 'listener'

    if (user && !(await canReceiveEmail(user.id, EMAIL_NOTIFICATION_TYPES.MIX_RELEASE))) {
      Effect.annotateCurrentSpan('totalRecipients', recipients.length).pipe(runAppFork)
      Effect.annotateCurrentSpan('mixSlug', input.mixSlug).pipe(runAppFork)
      Effect.annotateCurrentSpan('mixTitle', input.metadata?.mixTitle || mix.title).pipe(runAppFork)
      Effect.logInfo('[Email] Sending mix notification emails', {
        totalRecipients: recipients.length,
        mixSlug: input.mixSlug,
        mixTitle: input.metadata?.mixTitle || mix.title
      }).pipe(runAppFork)
      skipped.push(recipient)
      continue
    }

    const mixTitle = input.metadata?.mixTitle || mix.title
    const deliveryLog = await createEmailDeliveryLog({
      userId: user?.id,
      recipientEmail: recipient,
      recipientName: username,
      emailType: EMAIL_NOTIFICATION_TYPES.MIX_RELEASE,
      templateName: 'mix-notification',
      subject: `New mix: ${mixTitle}`,
      status: EMAIL_DELIVERY_STATUSES.PENDING,
      metadata: {
        mixId: mix.id,
        mixSlug: mix.slug,
        mixTitle,
        artistName: input.metadata?.artistName || 'Guide Fari',
        coverImageUrl,
        releaseDate
      }
    })

    try {
      await sendMixNotificationEmail({
        to: recipient,
        username,
        mixTitle,
        artistName: input.metadata?.artistName || 'Guide Fari',
        mixUrl,
        coverImageUrl,
        releaseDate
      })
      await markEmailDeliveryLogAsSent(deliveryLog.id)
      sentTo.push(recipient)
      emailIds.push(deliveryLog.id)
    } catch (error: unknown) {
      Effect.logError('[Email] Failed to send mix notification email', {
        recipient,
        userId: user?.id,
        mixSlug: input.mixSlug,
        mixTitle: input.metadata?.mixTitle || mix.title,
        emailLogId: deliveryLog.id,
        error: getErrorMessage(error)
      }).pipe(runAppFork)
      await markEmailDeliveryLogAsFailed(deliveryLog.id, getErrorMessage(error))
      errors.push(recipient)
    }
  }

  if (sentTo.length === 0 && skipped.length === 0) {
    throw new Error('Failed to send any emails')
  }

  return {
    success: true,
    sentTo,
    emailIds,
    message: `Successfully sent ${sentTo.length} notification(s)${
      skipped.length > 0 ? ` (${skipped.length} skipped due to preferences)` : ''
    }${errors.length > 0 ? ` (${errors.length} failed)` : ''}`
  }
}

const requireAdmin = Effect.gen(function* () {
  const { user } = yield* AuthSession
  if (user.role !== 'admin') {
    return yield* new HttpApiError.Forbidden()
  }
})

export const EmailHandlersLive = HttpApiBuilder.group(Api, 'email', (handlers) =>
  handlers
    .handle('sendMixNotification', ({ payload }) =>
      Effect.gen(function* () {
        yield* requireAdmin
        return yield* Effect.tryPromise({
          try: () => sendMixNotification(payload),
          catch: (error: unknown) =>
            error instanceof MixNotFoundError
              ? new HttpApiError.NotFound()
              : new DatabaseError({
                  message: `Failed to send mix notification emails: ${getErrorMessage(error)}`,
                  operation: 'send',
                  table: 'email_delivery_logs'
                })
        }).pipe(dieOnDatabaseError)
      })
    )
    .handle('getEmailLogs', ({ query }) =>
      Effect.gen(function* () {
        yield* requireAdmin
        const result = yield* Effect.tryPromise({
          try: () => getAdminEmailLogs(query),
          catch: (error: unknown) =>
            new DatabaseError({
              message: `Failed to fetch email logs: ${getErrorMessage(error)}`,
              operation: 'select',
              table: 'email_delivery_logs'
            })
        }).pipe(dieOnDatabaseError)

        return {
          data: result.data.map(toEmailLogResponse),
          pagination: result.pagination
        }
      })
    )
)
