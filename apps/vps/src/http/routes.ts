import { Effect, Layer } from 'effect'
import { HttpRouter, HttpServer, HttpServerRequest, HttpServerResponse } from 'effect/unstable/http'
import type { AppType } from '@/app'
import { auth } from '@/lib/auth'
import { prepareAuthRequest } from '@/routes/user/better-auth.routes'

// Routes every request to the existing Hono app unchanged. Removed one HttpApi group at a time as routes are ported (docs/migration-effect-http-api.md).
export const honoFallback = (honoApp: AppType) =>
  HttpRouter.add('*', '/*', (request) =>
    Effect.gen(function* () {
      const webRequest = yield* HttpServerRequest.toWeb(request)
      const webResponse = yield* Effect.promise(() => Promise.resolve(honoApp.fetch(webRequest)))
      return HttpServerResponse.fromWeb(webResponse)
    })
  )

// better-auth owns its own routing; we can't redefine it as HttpApiEndpoints. Kept at
// its own path (not under /api) since its basePath appears in emailed links.
const betterAuthRoute = HttpRouter.add('*', '/auth/*', (request) =>
  Effect.gen(function* () {
    const webRequest = yield* HttpServerRequest.toWeb(request)
    const webResponse = yield* Effect.promise(() =>
      Promise.resolve(auth.handler(prepareAuthRequest(webRequest)))
    )
    return HttpServerResponse.fromWeb(webResponse)
  })
)

export const createWebHandler = (honoApp: AppType) =>
  HttpRouter.toWebHandler(
    Layer.mergeAll(betterAuthRoute, honoFallback(honoApp), HttpServer.layerServices)
  )
