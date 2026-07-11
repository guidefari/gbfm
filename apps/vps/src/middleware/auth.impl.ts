import { AuthMiddleware, AuthSession } from '@gbfm/api/middleware/auth'
import { Effect, Layer } from 'effect'
import { HttpServerRequest } from 'effect/unstable/http'
import { HttpApiError } from 'effect/unstable/httpapi'
import { auth } from '@/lib/auth'

const clientIp = (headers: Readonly<Record<string, string>>) =>
  headers['x-forwarded-for'] ?? headers['x-real-ip'] ?? 'unknown'

export const AuthMiddlewareLive = Layer.succeed(AuthMiddleware, (httpEffect) =>
  Effect.gen(function* () {
    const request = yield* HttpServerRequest.HttpServerRequest

    // Logs (rather than silently discards) any error auth.api.getSession
    // throws -- e.g. malformed input or a plugin-chain error -- instead of
    // collapsing it into an indistinguishable 401. Note this does not cover
    // every failure mode: verified empirically that better-auth swallows a
    // downstream DB outage internally and returns null, not a throw, so that
    // specific case looks like "no session" in both the old Hono path and
    // here. Not a regression -- neither implementation can see past it.
    const session = yield* Effect.tryPromise({
      try: () => auth.api.getSession({ headers: new Headers(request.headers) }),
      catch: (cause) => cause
    }).pipe(
      Effect.tapError((cause) =>
        Effect.logError('[auth] getSession failed', {
          cause,
          path: request.url,
          method: request.method
        })
      ),
      Effect.mapError(() => new HttpApiError.Unauthorized())
    )

    if (!session) {
      yield* Effect.logWarning('[auth] unauthorized access attempt', {
        path: request.url,
        method: request.method,
        ip: clientIp(request.headers)
      })
      return yield* new HttpApiError.Unauthorized()
    }

    return yield* Effect.provideService(httpEffect, AuthSession, {
      user: session.user,
      session: session.session
    })
  })
)
