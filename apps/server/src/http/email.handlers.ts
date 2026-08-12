import { Api } from '@gbfm/api/api'
import { type SendMixNotificationInput, type SendMixNotificationResponse } from '@gbfm/api/email'
import { AuthSession } from '@gbfm/api/middleware/auth'
import { EMAIL_DELIVERY_STATUSES, type EmailDeliveryStatus } from '@gbfm/core/status'
import { buildNewMixNotificationEmail, EmailRenderError } from '@gbfm/email/index'
import { and, eq } from 'drizzle-orm'
import { Effect } from 'effect'
import { HttpApiBuilder, HttpApiError } from 'effect/unstable/httpapi'
import { Database } from '@/db/layer'
import { audioTable } from '@/db/audio.schema'
import { user as usersTable } from '@/db/auth.schema'
import {
  EMAIL_NOTIFICATION_TYPES,
  type EmailNotificationType,
  type SelectEmailDeliveryLog
} from '@/db/email.schema'
import { DatabaseError, getErrorMessage } from '@/errors'
import { dieOnDatabaseError as makeDieOnDatabaseError } from '@/http/handler-utils'
import { getAdminEmailLogs } from '@/repositories/email-delivery-log.repository'
import {
  canEmailReceive,
  getActiveMixRecipients
} from '@/repositories/email-preferences.repository'
import {
  EmailDelivery,
  EmailDeliveryPersistenceError,
  EmailDeliveryRejected,
  EmailDeliveryUnavailable
} from '@/services/email-delivery.service'

const dieOnDatabaseError = makeDieOnDatabaseError('email')

const EMAIL_TYPE_NORMALIZATION_MAP = new Map<string, EmailNotificationType>([
  ['TRANSACTIONAL', EMAIL_NOTIFICATION_TYPES.TRANSACTIONAL],
  ['MIX_RELEASE', EMAIL_NOTIFICATION_TYPES.MIX_RELEASE],
  ['MIXRELEASE', EMAIL_NOTIFICATION_TYPES.MIX_RELEASE],
  ['MIX_NOTIFICATION', EMAIL_NOTIFICATION_TYPES.MIX_RELEASE],
  ['MUSIC_REMINDER', EMAIL_NOTIFICATION_TYPES.MIX_RELEASE],
  ['PROMOTIONAL', EMAIL_NOTIFICATION_TYPES.PROMOTIONAL],
  ['SYSTEM', EMAIL_NOTIFICATION_TYPES.SYSTEM]
])

const EMAIL_STATUS_NORMALIZATION_MAP = new Map<string, EmailDeliveryStatus>([
  ['PENDING', EMAIL_DELIVERY_STATUSES.PENDING],
  ['SENT', EMAIL_DELIVERY_STATUSES.SENT],
  ['DELIVERED', EMAIL_DELIVERY_STATUSES.DELIVERED],
  ['BOUNCED', EMAIL_DELIVERY_STATUSES.BOUNCED],
  ['COMPLAINED', EMAIL_DELIVERY_STATUSES.COMPLAINED],
  ['FAILED', EMAIL_DELIVERY_STATUSES.FAILED],
  ['SUCCESS', EMAIL_DELIVERY_STATUSES.SENT],
  ['FAILURE', EMAIL_DELIVERY_STATUSES.FAILED]
])

const MIX_NOTIFICATION_SEND_CONCURRENCY = 5

type MixNotificationRecipientOutcome =
  | { readonly _tag: 'sent'; readonly recipient: string; readonly emailId: string }
  | { readonly _tag: 'skipped'; readonly recipient: string }
  | { readonly _tag: 'failed'; readonly recipient: string }

function normalizeRecipientEmail(value: string): string {
  return value.trim().toLowerCase()
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
    id: log.id,
    userId: log.userId,
    recipientEmail: log.recipientEmail,
    recipientName: log.recipientName,
    emailType:
      EMAIL_TYPE_NORMALIZATION_MAP.get(normalizedTypeToken) ?? EMAIL_NOTIFICATION_TYPES.SYSTEM,
    templateName: log.templateName,
    subject: log.subject,
    status:
      EMAIL_STATUS_NORMALIZATION_MAP.get(normalizedStatusToken) ?? EMAIL_DELIVERY_STATUSES.FAILED,
    provider: log.provider,
    providerMessageId: log.providerMessageId,
    failureCategory: log.failureCategory,
    errorMessage: log.errorMessage,
    sentAt: log.sentAt?.toISOString() ?? null,
    deliveredAt: log.deliveredAt?.toISOString() ?? null,
    bouncedAt: log.bouncedAt?.toISOString() ?? null,
    complainedAt: log.complainedAt?.toISOString() ?? null,
    createdAt: log.createdAt.toISOString(),
    updatedAt: log.updatedAt.toISOString()
  }
}

const databaseEffect = <A>(
  operation: DatabaseError['operation'],
  table: string,
  execute: () => Promise<A>
) =>
  Effect.tryPromise({
    try: execute,
    catch: (cause) =>
      new DatabaseError({
        message: `Email database ${operation} failed: ${getErrorMessage(cause)}`,
        operation,
        table
      })
  })

const sendMixNotification = (input: SendMixNotificationInput) =>
  Effect.gen(function* () {
    const db = yield* Database
    const delivery = yield* EmailDelivery
    const recipients =
      input.recipients && input.recipients.length > 0
        ? input.recipients.map(normalizeRecipientEmail)
        : yield* databaseEffect('select', 'user_email_preferences', () =>
            getActiveMixRecipients(db)
          )

    if (recipients.length === 0) {
      return { success: true, sentTo: [], emailIds: [], message: 'No opted-in recipients' }
    }

    const mix = yield* databaseEffect('select', 'audio', () =>
      db.query.audioTable.findFirst({
        where: and(
          eq(audioTable.slug, input.mixSlug),
          eq(audioTable.type, 'mix'),
          eq(audioTable.draft, false)
        ),
        with: { show: { columns: { thumbnailUrl: true } } }
      })
    )

    if (!mix) return yield* new HttpApiError.NotFound()

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

    const outcomes = yield* Effect.forEach(
      recipients,
      (recipient) =>
        Effect.gen(function* () {
          const canReceive = yield* databaseEffect('select', 'email_recipients', () =>
            canEmailReceive(recipient, EMAIL_NOTIFICATION_TYPES.MIX_RELEASE, db)
          )
          if (!canReceive) {
            return { _tag: 'skipped', recipient } as const
          }

          const [user] = yield* databaseEffect('select', 'user', () =>
            db.select().from(usersTable).where(eq(usersTable.email, recipient)).limit(1)
          )
          const username =
            user?.name || input.metadata?.username || recipient.split('@')[0] || 'listener'
          const mixTitle = input.metadata?.mixTitle || mix.title
          const message = yield* buildNewMixNotificationEmail({
            to: recipient,
            username,
            mixTitle,
            artistName: input.metadata?.artistName || 'Guide Fari',
            mixUrl,
            coverImageUrl,
            releaseDate
          })
          const receipt = yield* delivery.deliver({
            message,
            emailType: EMAIL_NOTIFICATION_TYPES.MIX_RELEASE,
            userId: user?.id,
            recipientName: username,
            safeMetadata: {
              kind: 'mix-notification',
              mixId: mix.id,
              mixSlug: mix.slug,
              mixTitle,
              artistName: input.metadata?.artistName || 'Guide Fari',
              releaseDate
            }
          })
          return { _tag: 'sent', recipient, emailId: receipt.deliveryLogId } as const
        }).pipe(
          Effect.catchTags({
            EmailRenderError: () => Effect.succeed({ _tag: 'failed', recipient } as const),
            EmailDeliveryPersistenceError: () =>
              Effect.succeed({ _tag: 'failed', recipient } as const),
            EmailDeliveryRejected: () => Effect.succeed({ _tag: 'failed', recipient } as const),
            EmailDeliveryUnavailable: () => Effect.succeed({ _tag: 'failed', recipient } as const)
          })
        ),
      { concurrency: MIX_NOTIFICATION_SEND_CONCURRENCY }
    )

    const sentTo = outcomes.flatMap((outcome) =>
      outcome._tag === 'sent' ? [outcome.recipient] : []
    )
    const skipped = outcomes.flatMap((outcome) =>
      outcome._tag === 'skipped' ? [outcome.recipient] : []
    )
    const errors = outcomes.flatMap((outcome) =>
      outcome._tag === 'failed' ? [outcome.recipient] : []
    )
    const emailIds = outcomes.flatMap((outcome) =>
      outcome._tag === 'sent' ? [outcome.emailId] : []
    )

    if (sentTo.length === 0 && skipped.length === 0) {
      return yield* new HttpApiError.InternalServerError()
    }

    return {
      success: true,
      sentTo,
      emailIds,
      message: `Successfully sent ${sentTo.length} notification(s)${
        skipped.length > 0 ? ` (${skipped.length} skipped due to preferences)` : ''
      }${errors.length > 0 ? ` (${errors.length} failed)` : ''}`
    }
  })

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
        return yield* sendMixNotification(payload).pipe(dieOnDatabaseError)
      })
    )
    .handle('getEmailLogs', ({ query }) =>
      Effect.gen(function* () {
        yield* requireAdmin
        const db = yield* Database
        const result = yield* Effect.tryPromise({
          try: () => getAdminEmailLogs(query, db),
          catch: (cause) =>
            new DatabaseError({
              message: `Failed to fetch email logs: ${getErrorMessage(cause)}`,
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
