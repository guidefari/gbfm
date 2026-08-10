import type { RenderedEmail } from '@gbfm/email/index'
import { Context, Data, Effect, Layer } from 'effect'

/** A fully addressed, single-recipient message passed to an email provider. */
export interface OutboundEmailMessage extends RenderedEmail {
  /** The parsed full sender address configured for this application. */
  readonly from: string
  /** The human-readable sender name. */
  readonly fromName: string
}

/** The finite provider identities retained in delivery logs. */
export const emailProviders = ['ses', 'cloudflare'] as const

/** A provider identity retained in a delivery log. */
export type EmailProvider = (typeof emailProviders)[number]

/** A safe reason why a provider rejected one email. */
export type EmailRejectionReason =
  | 'invalid-message'
  | 'sender-not-verified'
  | 'recipient-not-allowed'
  | 'recipient-suppressed'
  | 'delivery-failed'
  | 'content-too-large'

/** Cloudflare codes that map to a safe, actionable product rejection. */
export const cloudflareRejectedProviderCodes = [
  'E_VALIDATION_ERROR',
  'E_FIELD_MISSING',
  'E_TOO_MANY_RECIPIENTS',
  'E_TOO_MANY_ATTACHMENTS',
  'E_CONTENT_TOO_LARGE',
  'E_SENDER_NOT_VERIFIED',
  'E_SENDER_DOMAIN_NOT_AVAILABLE',
  'E_RECIPIENT_NOT_ALLOWED',
  'E_RECIPIENT_SUPPRESSED',
  'E_DELIVERY_FAILED'
] as const

/** A documented Cloudflare rejection code safe to expose to service callers and telemetry. */
export type CloudflareRejectedProviderCode = (typeof cloudflareRejectedProviderCodes)[number]

/** Safe finite availability classifications; arbitrary provider codes never cross this boundary. */
export const emailUnavailableProviderCodes = [
  'unknown',
  'invalid-receipt',
  'not-configured'
] as const

/** A safe finite code for an unavailable email transport. */
export type EmailUnavailableProviderCode = (typeof emailUnavailableProviderCodes)[number]

/** A safe provider rejection that callers may handle without inspecting message content. */
export class EmailRejected extends Data.TaggedError('EmailRejected')<{
  readonly reason: EmailRejectionReason
  readonly providerCode?: CloudflareRejectedProviderCode | undefined
}> {}

/** A provider outage or unknown provider outcome with no raw provider cause in the service contract. */
export class EmailUnavailable extends Data.TaggedError('EmailUnavailable')<{
  readonly providerCode?: EmailUnavailableProviderCode | undefined
}> {}

/** A provider receipt after it accepted one email. */
export interface TransportReceipt {
  /** The provider that accepted the message. */
  readonly provider: 'cloudflare'
  /** The non-empty opaque provider message ID. */
  readonly messageId: string
}

/** The service-facing boundary for one provider email submission. */
export interface EmailTransportService {
  /** Sends one complete message once and returns its provider receipt. */
  readonly send: (
    message: OutboundEmailMessage
  ) => Effect.Effect<TransportReceipt, EmailRejected | EmailUnavailable>
}

/** The provider-neutral email transport capability. */
export const EmailTransport = Context.Service<EmailTransportService>('EmailTransport')

/** The observable state exposed by the local and test-only recording transport. */
export interface RecordingEmailTransport {
  /** Messages submitted through this transport, in send order. */
  readonly messages: ReadonlyArray<OutboundEmailMessage>
  /** The layer that provides the recording transport at the production seam. */
  readonly layer: Layer.Layer<EmailTransportService>
}

/** Configuration for the recording transport. */
export interface RecordingEmailTransportOptions {
  /** The deterministic receipt message ID returned for accepted sends. */
  readonly messageId?: string
  /** A typed rejection returned for every attempted send. */
  readonly failure?: EmailRejected
  /** Makes every attempted send unavailable without invoking a real provider. */
  readonly unavailable?: boolean
}

/**
 * Creates a transport that records messages locally and never sends an email.
 *
 * @returns A real `EmailTransport` layer plus immutable message snapshots for assertions.
 */
export function makeRecordingEmailTransport(
  options: RecordingEmailTransportOptions = {}
): RecordingEmailTransport {
  const sent: Array<OutboundEmailMessage> = []
  const messageId = options.messageId ?? 'recorded-email'

  return {
    get messages() {
      return sent
    },
    layer: Layer.succeed(EmailTransport, {
      send: (message) => {
        sent.push(message)
        if (options.failure) return Effect.fail(options.failure)
        if (options.unavailable) return Effect.fail(new EmailUnavailable({}))
        return Effect.succeed({ provider: 'cloudflare', messageId })
      }
    })
  }
}

/** The default local transport; it prevents accidental real email delivery. */
export const RecordingEmailTransportLayer = makeRecordingEmailTransport().layer

/**
 * Provides a safe failure until the Worker-only Cloudflare binding adapter is added.
 *
 * The next infrastructure slice replaces this layer at the Worker composition seam.
 */
export const UnconfiguredEmailTransportLayer = Layer.succeed(EmailTransport, {
  send: () => Effect.fail(new EmailUnavailable({ providerCode: 'not-configured' }))
})
