import { Api } from '@gbfm/api/api'
import { Effect, Layer } from 'effect'
import {
  HttpMiddleware,
  HttpRouter,
  HttpServer,
  HttpServerRequest,
  HttpServerResponse
} from 'effect/unstable/http'
import { HttpApiBuilder, HttpApiScalar } from 'effect/unstable/httpapi'
import type { AppType } from '@/app'
import { auth, prepareAuthRequest } from '@/lib/auth'
import { corsConfig } from '@/lib/create-app'
import { HealthHandlers } from './health.handlers'

const isAllowedOrigin = (origin: string) => corsConfig.origin(origin) === origin

const CorsLive = HttpRouter.middleware(
  HttpMiddleware.cors({
    allowedOrigins: isAllowedOrigin,
    allowedMethods: corsConfig.allowMethods,
    allowedHeaders: corsConfig.allowHeaders,
    exposedHeaders: corsConfig.exposeHeaders,
    credentials: corsConfig.credentials
  }),
  { global: true }
)

const BetterAuthRoutes = HttpRouter.use((router) =>
  router.add('*', '/auth/*', (request) =>
    HttpServerRequest.toWeb(request).pipe(
      Effect.flatMap((webRequest) =>
        Effect.promise(() => auth.handler(prepareAuthRequest(webRequest)))
      ),
      Effect.map(HttpServerResponse.fromWeb)
    )
  )
)

const honoFallbackRoutes = (honoApp: AppType) =>
  HttpRouter.use((router) =>
    router.add('*', '/*', (request) =>
      HttpServerRequest.toWeb(request).pipe(
        Effect.flatMap((webRequest) =>
          Effect.promise(() => Promise.resolve(honoApp.fetch(webRequest)))
        ),
        Effect.map(HttpServerResponse.fromWeb)
      )
    )
  )

export const createWebHandler = (honoApp: AppType) => {
  const apiRoutes = HttpApiBuilder.layer(Api, { openapiPath: '/openapi.json' }).pipe(
    Layer.provide(HealthHandlers)
  )

  const routes = Layer.mergeAll(
    apiRoutes,
    HttpApiScalar.layer(Api, { path: '/effect-reference' }),
    BetterAuthRoutes,
    honoFallbackRoutes(honoApp)
  ).pipe(Layer.provide(CorsLive), Layer.provide(HttpServer.layerServices))

  return HttpRouter.toWebHandler(routes, { disableLogger: true })
}
