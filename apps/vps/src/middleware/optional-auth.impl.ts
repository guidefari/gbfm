import { Context, Effect, Layer } from 'effect'
import { Cookies, HttpEffect, HttpServerRequest, HttpServerResponse } from 'effect/unstable/http'
import type { NavigationIdentity } from '@/domain/navigation'
import { auth } from '@/lib/auth'

export class IdentityResolver extends Context.Service<
  IdentityResolver,
  {
    readonly resolve: Effect.Effect<NavigationIdentity, never, HttpServerRequest.HttpServerRequest>
  }
>()('middleware/IdentityResolver') {}

const userIdentity = (userId: string): NavigationIdentity => ({ _tag: 'User', userId })

const anonymousIdentity = (deviceToken: string): NavigationIdentity => ({
  _tag: 'Anonymous',
  deviceToken
})

const deviceTokenCookieName = 'gbfm-navigation-device'

const deviceTokenCookie: NonNullable<Cookies.Cookie['options']> = {
  httpOnly: true,
  path: '/api/content/posts/micro',
  sameSite: 'lax',
  secure: true
}

const getSession = (request: HttpServerRequest.HttpServerRequest) =>
  Effect.tryPromise({
    try: () => auth.api.getSession({ headers: new Headers(request.headers) }),
    catch: () => null
  }).pipe(
    Effect.tapError(() =>
      Effect.logWarning('[optional-auth] getSession failed', {
        method: request.method,
        path: request.url
      })
    ),
    Effect.orElseSucceed(() => null)
  )

export const IdentityResolverLive = Layer.succeed(IdentityResolver, {
  resolve: Effect.gen(function* () {
    const request = yield* HttpServerRequest.HttpServerRequest
    const session = yield* getSession(request)

    if (session) {
      return userIdentity(session.user.id)
    }

    const deviceToken = request.cookies[deviceTokenCookieName]
    if (deviceToken) {
      return anonymousIdentity(deviceToken)
    }

    const mintedDeviceToken = crypto.randomUUID()
    yield* HttpEffect.appendPreResponseHandler((_request, response) =>
      Effect.succeed(
        HttpServerResponse.setCookieUnsafe(
          response,
          deviceTokenCookieName,
          mintedDeviceToken,
          deviceTokenCookie
        )
      )
    )

    return anonymousIdentity(mintedDeviceToken)
  })
})
