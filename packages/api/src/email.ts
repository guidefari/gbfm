import { Effect, Schema } from 'effect'
import { HttpApiEndpoint, HttpApiError, HttpApiGroup } from 'effect/unstable/httpapi'
import { AuthMiddleware } from './middleware/auth'

const EmailPattern =
  /^(?!\.)(?!.*\.\.)([A-Za-z0-9_'+\-.]*)[A-Za-z0-9_+-]@([A-Za-z0-9][A-Za-z0-9-]*\.)+[A-Za-z]{2,}$/
const Email = Schema.String.pipe(Schema.check(Schema.isPattern(EmailPattern)))
const UrlString = Schema.String.pipe(
  Schema.check(
    Schema.makeFilter((value) => {
      try {
        new URL(value)
        return undefined
      } catch {
        return 'must be a valid URL'
      }
    })
  )
)
const DateOnly = Schema.String.pipe(
  Schema.check(Schema.isPattern(/^\d{4}-\d{2}-\d{2}$/)),
  Schema.check(
    Schema.makeFilter((value) => {
      const [year, month, day] = value.split('-').map(Number)
      const date = new Date(`${value}T00:00:00.000Z`)

      return date.getUTCFullYear() === year &&
        date.getUTCMonth() + 1 === month &&
        date.getUTCDate() === day
        ? undefined
        : 'must be a valid calendar date'
    })
  )
)

/** Maximum explicit recipients accepted by an admin mix-notification request. */
export const MAX_MIX_NOTIFICATION_RECIPIENTS = 50

const EmailLogStatus = Schema.Literals([
  'PENDING',
  'SENT',
  'DELIVERED',
  'BOUNCED',
  'COMPLAINED',
  'FAILED'
] as const)

const EmailType = Schema.Literals([
  'TRANSACTIONAL',
  'MIX_RELEASE',
  'PROMOTIONAL',
  'SYSTEM'
] as const)

const PaginationMeta = Schema.Struct({
  total: Schema.Number,
  limit: Schema.Number,
  offset: Schema.Number,
  hasMore: Schema.Boolean
})

const EmailLog = Schema.Struct({
  id: Schema.String,
  userId: Schema.NullOr(Schema.String),
  recipientEmail: Schema.String,
  recipientName: Schema.NullOr(Schema.String),
  emailType: EmailType,
  templateName: Schema.String,
  subject: Schema.String,
  status: EmailLogStatus,
  provider: Schema.NullOr(Schema.Literals(['ses', 'cloudflare'])),
  providerMessageId: Schema.NullOr(Schema.String),
  failureCategory: Schema.NullOr(
    Schema.Literals([
      'invalid-message',
      'sender-not-verified',
      'recipient-not-allowed',
      'recipient-suppressed',
      'delivery-failed',
      'content-too-large',
      'unavailable'
    ])
  ),
  errorMessage: Schema.NullOr(Schema.String),
  sentAt: Schema.NullOr(Schema.String),
  deliveredAt: Schema.NullOr(Schema.String),
  bouncedAt: Schema.NullOr(Schema.String),
  complainedAt: Schema.NullOr(Schema.String),
  createdAt: Schema.String,
  updatedAt: Schema.String
})

export const EmailLogsResponse = Schema.Struct({
  data: Schema.Array(EmailLog),
  pagination: PaginationMeta
})
export type EmailLogsResponse = typeof EmailLogsResponse.Type

const PaginationQuery = {
  limit: Schema.FiniteFromString.pipe(
    Schema.check(Schema.isBetween({ minimum: 1, maximum: 100 })),
    Schema.withDecodingDefaultType(Effect.succeed(20))
  ),
  offset: Schema.FiniteFromString.pipe(
    Schema.check(Schema.isGreaterThanOrEqualTo(0)),
    Schema.withDecodingDefaultType(Effect.succeed(0))
  )
}

export const SendMixNotificationInput = Schema.Struct({
  recipients: Schema.optional(
    Schema.Array(Email).pipe(Schema.check(Schema.isMaxLength(MAX_MIX_NOTIFICATION_RECIPIENTS)))
  ),
  mixSlug: Schema.NonEmptyString,
  metadata: Schema.optional(
    Schema.Struct({
      username: Schema.optional(Schema.String),
      mixTitle: Schema.optional(Schema.String),
      artistName: Schema.optional(Schema.String),
      coverImageUrl: Schema.optional(UrlString),
      releaseDate: Schema.optional(Schema.String)
    })
  )
})
export type SendMixNotificationInput = typeof SendMixNotificationInput.Type

export const SendMixNotificationResponse = Schema.Struct({
  success: Schema.Boolean,
  sentTo: Schema.Array(Schema.String),
  emailIds: Schema.Array(Schema.String),
  message: Schema.String
})
export type SendMixNotificationResponse = typeof SendMixNotificationResponse.Type

export const EmailLogsQuery = Schema.Struct({
  ...PaginationQuery,
  status: Schema.optional(EmailLogStatus),
  recipientEmail: Schema.optional(Schema.Trim.pipe(Schema.check(Schema.isNonEmpty()))),
  dateFrom: Schema.optional(DateOnly),
  dateTo: Schema.optional(DateOnly)
}).pipe(
  Schema.check(
    Schema.makeFilter((value) =>
      value.dateFrom && value.dateTo && value.dateFrom > value.dateTo
        ? { path: ['dateFrom'], issue: 'dateFrom must be before or equal to dateTo' }
        : undefined
    )
  )
)
export type EmailLogsQuery = typeof EmailLogsQuery.Type

export const EmailGroup = HttpApiGroup.make('email')
  .add(
    HttpApiEndpoint.post('sendMixNotification', '/api/email/send-mix-notification', {
      payload: SendMixNotificationInput,
      success: SendMixNotificationResponse,
      error: [HttpApiError.Forbidden, HttpApiError.NotFound, HttpApiError.InternalServerError]
    }).middleware(AuthMiddleware)
  )
  .add(
    HttpApiEndpoint.get('getEmailLogs', '/api/email/logs', {
      query: EmailLogsQuery,
      success: EmailLogsResponse,
      error: [HttpApiError.Forbidden, HttpApiError.InternalServerError]
    }).middleware(AuthMiddleware)
  )
