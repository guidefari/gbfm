import type { AudioPagePrincipal } from '@gbfm/api/audio'
import { Effect } from 'effect'
import { Cookies, HttpEffect, HttpServerRequest, HttpServerResponse } from 'effect/unstable/http'

import { Auth } from '@/lib/auth'

export const resolvePageSession = Effect.fn('auth.resolvePageSession')(function* () {
  const request = yield* HttpServerRequest.HttpServerRequest
  const auth = yield* Auth
  const headers = new Headers(request.headers)

  yield* HttpEffect.appendPreResponseHandler((_request, response) =>
    Effect.succeed(HttpServerResponse.setHeader(response, 'cache-control', 'private, no-store')),
  )

  if (!headers.get('cookie')?.includes('session_token=') && !headers.has('authorization'))
    return null

  const result = yield* Effect.tryPromise({
    try: () => auth.api.getSession({ headers, returnHeaders: true }),
    catch: () => null,
  }).pipe(
    Effect.tapError(() =>
      Effect.logWarning({ operation: 'auth.resolvePageSession', errorTag: 'SessionLookupFailed' }),
    ),
    Effect.orElseSucceed(() => null),
  )

  if (!result) return null

  const cookies = Cookies.fromSetCookie(result.headers.getSetCookie())
  yield* HttpEffect.appendPreResponseHandler((_request, response) =>
    Effect.succeed(HttpServerResponse.mergeCookies(response, cookies)),
  )

  if (!result.response) return null

  const user = result.response.user

  const principal: AudioPagePrincipal = {
    id: user.id,
    name: user.name || null,
    username: user.username ?? null,
    image: user.image ?? null,
    role: user.role ?? 'user',
  }

  return principal
})
