import { Context, Effect, Layer, Redacted, Schema } from 'effect'

export class SignupRejected extends Schema.TaggedError<SignupRejected>()('SignupRejected', {
  reason: Schema.Literals(['verification', 'rate-limit', 'unavailable']),
}) {}

export class SignupProtection extends Context.Service<
  SignupProtection,
  {
    readonly authorize: (input: {
      readonly token: string
      readonly ip: string | undefined
      readonly action: 'newsletter-subscribe' | 'account-signup'
    }) => Effect.Effect<void, SignupRejected>
  }
>()('SignupProtection') {}

const Verification = Schema.Struct({
  success: Schema.Boolean,
  hostname: Schema.optional(Schema.String),
  action: Schema.optional(Schema.String),
})

/** Verifies at the API boundary, including requests forwarded through the WWW service binding. */
export const SignupProtectionLayer = (input: {
  readonly secret: Redacted.Redacted
  readonly hostnames: ReadonlyArray<string>
  readonly limit: (key: string) => Promise<boolean>
  readonly fetch?: (url: string, init: RequestInit) => Promise<Response>
}) =>
  Layer.succeed(SignupProtection, {
    authorize: Effect.fn('SignupProtection.authorize')(function* ({ token, ip, action }) {
      if (!ip || !token || token.length > 2048)
        return yield* new SignupRejected({ reason: 'verification' })

      const allowed = yield* Effect.tryPromise({
        try: () => input.limit(`${action}:${ip}`),
        catch: () => new SignupRejected({ reason: 'unavailable' }),
      })

      if (!allowed) return yield* new SignupRejected({ reason: 'rate-limit' })

      const response = yield* Effect.tryPromise({
        try: () =>
          (input.fetch ?? fetch)('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              secret: Redacted.value(input.secret),
              response: token,
              remoteip: ip,
            }),
            signal: AbortSignal.timeout(5000),
          }),
        catch: () => new SignupRejected({ reason: 'unavailable' }),
      })

      if (!response.ok) return yield* new SignupRejected({ reason: 'unavailable' })

      const body = yield* Effect.tryPromise({
        try: () => response.json(),
        catch: () => new SignupRejected({ reason: 'unavailable' }),
      })

      const verification = yield* Schema.decodeUnknownEffect(Verification)(body).pipe(
        Effect.mapError(() => new SignupRejected({ reason: 'unavailable' })),
      )

      if (
        !verification.success ||
        !input.hostnames.includes(verification.hostname ?? '') ||
        verification.action !== action
      )
        return yield* new SignupRejected({ reason: 'verification' })

      return undefined
    }),
  })

export const SignupProtectionUnavailableLayer = Layer.succeed(SignupProtection, {
  authorize: () => Effect.fail(new SignupRejected({ reason: 'unavailable' })),
})
