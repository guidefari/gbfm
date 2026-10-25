import { Context, Effect, Layer, Redacted, Schema } from 'effect'
import { HttpClient, HttpClientRequest, HttpClientResponse } from 'effect/http'

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
  'error-codes': Schema.optional(Schema.Array(Schema.String)),
})

/** Verifies at the API boundary, including requests forwarded through the WWW service binding. */
export const SignupProtectionLayer = (input: {
  readonly secret: Redacted.Redacted
  readonly hostnames: ReadonlyArray<string>
  readonly limit: (key: string) => Promise<boolean>
}) =>
  Layer.effect(
    SignupProtection,
    Effect.gen(function* () {
      const client = yield* HttpClient.HttpClient

      return {
        authorize: Effect.fn('SignupProtection.authorize')(function* ({ token, ip, action }) {
          if (!ip || !token || token.length > 2048)
            return yield* new SignupRejected({ reason: 'verification' })

          const allowed = yield* Effect.tryPromise({
            try: () => input.limit(`${action}:${ip}`),
            catch: () => new SignupRejected({ reason: 'unavailable' }),
          }).pipe(
            Effect.tapError(() => Effect.logWarning('Signup rate limiter unavailable', { action })),
          )

          if (!allowed) return yield* new SignupRejected({ reason: 'rate-limit' })

          const request = HttpClientRequest.post(
            'https://challenges.cloudflare.com/turnstile/v0/siteverify',
          ).pipe(
            HttpClientRequest.bodyText(
              JSON.stringify({
                secret: Redacted.value(input.secret),
                response: token,
                remoteip: ip,
              }),
              'application/json',
            ),
          )

          const verification = yield* client.execute(request).pipe(
            Effect.flatMap(HttpClientResponse.filterStatusOk),
            Effect.flatMap(HttpClientResponse.schemaBodyJson(Verification)),
            Effect.timeout('5 seconds'),
            Effect.tapError(() =>
              Effect.logWarning('Turnstile siteverify unavailable', { action }),
            ),
            Effect.mapError(() => new SignupRejected({ reason: 'unavailable' })),
          )

          const configurationCodes = (verification['error-codes'] ?? []).filter(
            (code) => code === 'missing-input-secret' || code === 'invalid-input-secret',
          )

          if (configurationCodes.length > 0) {
            yield* Effect.logError('Turnstile secret rejected by siteverify', {
              action,
              codes: configurationCodes,
            })

            return yield* new SignupRejected({ reason: 'unavailable' })
          }

          if (
            !verification.success ||
            !input.hostnames.includes(verification.hostname ?? '') ||
            verification.action !== action
          )
            return yield* new SignupRejected({ reason: 'verification' })

          return undefined
        }),
      }
    }),
  )

export const SignupProtectionUnavailableLayer = Layer.succeed(SignupProtection, {
  authorize: () => Effect.fail(new SignupRejected({ reason: 'unavailable' })),
})
