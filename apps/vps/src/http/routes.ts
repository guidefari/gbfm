import { Effect, Layer } from 'effect'
import { HttpRouter, HttpServer, HttpServerRequest, HttpServerResponse } from 'effect/unstable/http'
import type { AppType } from '@/app'

// Routes every request to the existing Hono app unchanged. Removed one HttpApi group at a time as routes are ported (docs/migration-effect-http-api.md).
export const honoFallback = (honoApp: AppType) =>
  HttpRouter.add('*', '/*', (request) =>
    Effect.gen(function* () {
      const webRequest = yield* HttpServerRequest.toWeb(request)
      const webResponse = yield* Effect.promise(() => Promise.resolve(honoApp.fetch(webRequest)))
      return HttpServerResponse.fromWeb(webResponse)
    })
  )

export const createWebHandler = (honoApp: AppType) =>
  HttpRouter.toWebHandler(Layer.mergeAll(honoFallback(honoApp), HttpServer.layerServices))
