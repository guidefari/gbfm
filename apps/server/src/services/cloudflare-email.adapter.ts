import { Effect, Layer, Option, Schema } from 'effect'
import {
  EmailRejected,
  EmailTransport,
  EmailUnavailable,
  type CloudflareRejectedProviderCode,
  type EmailTransportService,
  type OutboundEmailMessage
} from './email-transport.service'

/** The structural portion of the Worker `send_email` binding used by this adapter. */
export interface CloudflareEmailBinding {
  /** Submits a structured email through Cloudflare Email Sending. */
  readonly send: (message: CloudflareEmailMessage) => Promise<CloudflareEmailSendResult>
}

/** The structured message shape accepted by the Worker email binding. */
export interface CloudflareEmailMessage {
  readonly from: { readonly email: string; readonly name: string }
  readonly to: string
  readonly subject: string
  readonly html: string
  readonly text: string
  readonly replyTo?: string
}

/** The receipt shape returned by the Worker email binding. */
export interface CloudflareEmailSendResult {
  readonly messageId: string
}

const rejectionReasons = {
  E_VALIDATION_ERROR: 'invalid-message',
  E_FIELD_MISSING: 'invalid-message',
  E_TOO_MANY_RECIPIENTS: 'invalid-message',
  E_TOO_MANY_ATTACHMENTS: 'invalid-message',
  E_CONTENT_TOO_LARGE: 'content-too-large',
  E_SENDER_NOT_VERIFIED: 'sender-not-verified',
  E_SENDER_DOMAIN_NOT_AVAILABLE: 'sender-not-verified',
  E_RECIPIENT_NOT_ALLOWED: 'recipient-not-allowed',
  E_RECIPIENT_SUPPRESSED: 'recipient-suppressed',
  E_DELIVERY_FAILED: 'delivery-failed'
} as const satisfies Record<CloudflareRejectedProviderCode, EmailRejected['reason']>

const isCloudflareRejectionCode = (value: string): value is CloudflareRejectedProviderCode =>
  Object.hasOwn(rejectionReasons, value)

const CloudflareError = Schema.Struct({ code: Schema.String })

const providerCodeFrom = (cause: unknown): string | undefined => {
  const parsed = Schema.decodeUnknownOption(CloudflareError)(cause)
  return Option.isSome(parsed) ? parsed.value.code : undefined
}

const classifyCloudflareError = (cause: unknown): EmailRejected | EmailUnavailable => {
  const providerCode = providerCodeFrom(cause)
  if (providerCode && isCloudflareRejectionCode(providerCode)) {
    return new EmailRejected({ reason: rejectionReasons[providerCode], providerCode })
  }
  return new EmailUnavailable({ providerCode: 'unknown' })
}

const toCloudflareMessage = (message: OutboundEmailMessage): CloudflareEmailMessage => {
  const base = {
    from: { email: message.from, name: message.fromName },
    to: message.to,
    subject: message.subject,
    html: message.html,
    text: message.text
  }
  return message.replyTo === undefined ? base : { ...base, replyTo: message.replyTo }
}

const sendWithCloudflare = (binding: CloudflareEmailBinding, message: OutboundEmailMessage) =>
  Effect.tryPromise({
    try: () => binding.send(toCloudflareMessage(message)),
    catch: classifyCloudflareError
  }).pipe(
    Effect.flatMap((result) =>
      result.messageId.trim().length === 0
        ? Effect.fail(new EmailUnavailable({ providerCode: 'invalid-receipt' }))
        : Effect.succeed({ provider: 'cloudflare' as const, messageId: result.messageId })
    )
  )

/** Provides the application transport backed by one request-local Worker email binding. */
export const CloudflareEmailTransportLayer = (binding: CloudflareEmailBinding) =>
  Layer.succeed(EmailTransport, {
    send: (message) => sendWithCloudflare(binding, message)
  } satisfies EmailTransportService)
