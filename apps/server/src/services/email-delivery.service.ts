import type { RenderedEmail } from '@gbfm/email/index'
import { Clock, Context, Data, Effect, Layer, Result } from 'effect'
import {
  type EmailDeliveryFailureCategory,
  type EmailDeliveryMetadata,
  type EmailNotificationType
} from '@/db/email.schema'
import { Database } from '@/db/layer'
import {
  createPendingEmailDeliveryLog,
  markEmailDeliveryLogAsFailed,
  markEmailDeliveryLogAsSent
} from '@/repositories/email-delivery-log.repository'
import { ConfigService } from '@/services/config.service'
import { recordEmailFail, recordEmailSend } from '@/lib/performance-monitoring'
import { EmailRejected, EmailTransport, EmailUnavailable } from './email-transport.service'

const EMAIL_ADDRESS_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const senderName = 'goosebumps.fm'

/** A safe delivery-log persistence failure. */
export class EmailDeliveryPersistenceError extends Data.TaggedError(
  'EmailDeliveryPersistenceError'
)<{
  readonly operation: 'create-pending' | 'mark-sent' | 'mark-failed'
}> {}

/** A provider rejection after the delivery log records a safe failure category. */
export class EmailDeliveryRejected extends Data.TaggedError('EmailDeliveryRejected')<{
  readonly category: Exclude<EmailDeliveryFailureCategory, 'unavailable'>
}> {}

/** A provider availability failure after the delivery log records a safe failure category. */
export class EmailDeliveryUnavailable extends Data.TaggedError('EmailDeliveryUnavailable')<{}> {}

/** The expected failures from a delivery request. */
export type EmailDeliveryError =
  | EmailDeliveryPersistenceError
  | EmailDeliveryRejected
  | EmailDeliveryUnavailable

/** The fully persisted provider receipt returned to product workflows. */
export interface EmailDeliveryReceipt {
  /** The delivery-log row that records this receipt. */
  readonly deliveryLogId: string
  /** The provider that accepted the message. */
  readonly provider: 'cloudflare'
  /** The opaque provider message ID. */
  readonly providerMessageId: string
  /** The application-clock instant after provider acceptance. */
  readonly acceptedAt: Date
}

/** Input for one rendered message delivery attempt. */
export interface DeliveryRequest {
  /** The provider-neutral rendered message. */
  readonly message: RenderedEmail
  /** The product notification category. */
  readonly emailType: EmailNotificationType
  /** The related user when the delivery belongs to an account. */
  readonly userId?: string
  /** The recipient's display name for restricted operational use. */
  readonly recipientName?: string
  /** Closed operational metadata safe to retain with the delivery log. */
  readonly safeMetadata?: EmailDeliveryMetadata
}

/** Owns email-log transitions and one provider delivery attempt. */
export interface EmailDeliveryService {
  /** Delivers one rendered message and persists either an accepted receipt or a safe failure. */
  readonly deliver: (
    request: DeliveryRequest
  ) => Effect.Effect<EmailDeliveryReceipt, EmailDeliveryError>
}

/** The application email-delivery workflow. */
export const EmailDelivery = Context.Service<EmailDeliveryService>('EmailDelivery')

const toFailureCategory = (
  failure: EmailRejected | EmailUnavailable
): EmailDeliveryFailureCategory =>
  failure._tag === 'EmailRejected' ? failure.reason : 'unavailable'

const persist = <A>(
  operation: EmailDeliveryPersistenceError['operation'],
  effect: () => Promise<A>
): Effect.Effect<A, EmailDeliveryPersistenceError> =>
  Effect.tryPromise({
    try: effect,
    catch: () => new EmailDeliveryPersistenceError({ operation })
  }).pipe(
    Effect.tapError((error) =>
      Effect.andThen(
        Effect.annotateCurrentSpan('email.persistence_operation', error.operation),
        recordEmailFail
      )
    )
  )

const parseConfiguredSender = (value: string): string => {
  const sender = value.trim()
  if (!EMAIL_ADDRESS_PATTERN.test(sender)) {
    throw new Error('Configured email sender must be a full email address')
  }
  return sender
}

/** Builds the delivery service after parsing the configured full sender once at composition. */
export const EmailDeliveryLive = Layer.effect(
  EmailDelivery,
  Effect.gen(function* () {
    const database = yield* Database
    const transport = yield* EmailTransport
    const clock = yield* Clock.Clock
    const config = yield* ConfigService
    const from = parseConfiguredSender(config.auth.emailSender)

    return {
      deliver: (request) =>
        Effect.gen(function* () {
          const pending = yield* persist('create-pending', () =>
            createPendingEmailDeliveryLog(
              {
                userId: request.userId,
                recipientEmail: request.message.to,
                recipientName: request.recipientName,
                emailType: request.emailType,
                templateName: request.message.templateName,
                subject: request.message.subject,
                metadata: request.safeMetadata
              },
              database
            )
          )

          const transportResult = yield* Effect.result(
            transport.send({ ...request.message, from, fromName: senderName })
          )

          if (Result.isFailure(transportResult)) {
            const failure = transportResult.failure
            const failureCategory = toFailureCategory(failure)
            yield* Effect.annotateCurrentSpan(
              'email.outcome',
              failure._tag === 'EmailRejected' ? 'rejected' : 'unavailable'
            )
            if (failure.providerCode) {
              yield* Effect.annotateCurrentSpan('email.provider_code', failure.providerCode)
            }
            const failedAt = new Date(yield* clock.currentTimeMillis)
            yield* persist('mark-failed', () =>
              markEmailDeliveryLogAsFailed(pending.id, failureCategory, failedAt, database)
            )
            yield* recordEmailFail

            if (failure._tag === 'EmailRejected') {
              return yield* new EmailDeliveryRejected({ category: failure.reason })
            }
            return yield* new EmailDeliveryUnavailable()
          }

          const receipt = transportResult.success
          if (receipt.messageId.trim().length === 0) {
            yield* Effect.annotateCurrentSpan('email.outcome', 'unavailable')
            yield* Effect.annotateCurrentSpan('email.provider_code', 'invalid-receipt')
            const failedAt = new Date(yield* clock.currentTimeMillis)
            yield* persist('mark-failed', () =>
              markEmailDeliveryLogAsFailed(pending.id, 'unavailable', failedAt, database)
            )
            yield* recordEmailFail
            return yield* new EmailDeliveryUnavailable()
          }

          yield* Effect.annotateCurrentSpan('email.outcome', 'accepted')
          const acceptedAt = new Date(yield* clock.currentTimeMillis)
          yield* persist('mark-sent', () =>
            markEmailDeliveryLogAsSent(
              pending.id,
              {
                provider: receipt.provider,
                providerMessageId: receipt.messageId,
                acceptedAt
              },
              database
            )
          )
          yield* recordEmailSend

          return {
            deliveryLogId: pending.id,
            provider: receipt.provider,
            providerMessageId: receipt.messageId,
            acceptedAt
          }
        }).pipe(
          Effect.withSpan('email.delivery', {
            attributes: {
              'email.template': request.message.templateName,
              'email.type': request.emailType
            }
          })
        )
    }
  })
)
