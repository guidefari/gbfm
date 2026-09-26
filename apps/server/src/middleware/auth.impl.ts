import { AuthMiddleware, AuthSession } from '@gbfm/api/middleware/auth'
import { Effect, Layer } from 'effect'
import { HttpServerRequest } from 'effect/unstable/http'
import { HttpApiError } from 'effect/unstable/httpapi'

import { Auth } from '@/lib/auth'

export const AuthMiddlewareLive = Layer.effect(
  AuthMiddleware,
  Effect.gen(function* () {
    const auth = yield* Auth

    return (httpEffect) =>
      Effect.gen(function* () {
        const request = yield* HttpServerRequest.HttpServerRequest

        const session = yield* Effect.tryPromise({
          try: () => auth.api.getSession({ headers: new Headers(request.headers) }),
          catch: (cause) => ({ cause }),
        }).pipe(
          Effect.tapError((cause) =>
            Effect.logError('[auth] getSession failed', {
              cause,
              path: request.url,
              method: request.method,
            }),
          ),
          Effect.mapError(() => new HttpApiError.Unauthorized()),
        )

        if (!session) {
          yield* Effect.logWarning('[auth] unauthorized access attempt', {
            route: new URL(request.url, 'http://localhost').pathname,
            method: request.method,
          })

          return yield* new HttpApiError.Unauthorized()
        }

        return yield* Effect.provideService(httpEffect, AuthSession, {
          user: session.user,
          session: session.session,
        })
      })
  }),
)
