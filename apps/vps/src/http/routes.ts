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
import { corsConfig } from '@/lib/create-app'
import { HealthHandlersLive, makeHealthHandlers, type HealthDatabase } from './health.handlers'

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

interface CreateWebHandlerOptions {
  readonly healthDatabase?: HealthDatabase
}

interface WebHandler {
  readonly handler: (request: Request) => Promise<Response>
  readonly dispose: () => Promise<void>
}

export const createWebHandler = (
  honoApp: AppType,
  options: CreateWebHandlerOptions = {}
): WebHandler => {
  const healthHandlers = options.healthDatabase
    ? makeHealthHandlers(options.healthDatabase)
    : HealthHandlersLive

  const apiRoutes = HttpApiBuilder.layer(Api, { openapiPath: '/openapi.json' }).pipe(
    Layer.provide(healthHandlers)
  )

  const routes = Layer.mergeAll(
    apiRoutes,
    HttpApiScalar.layer(Api, { path: '/effect-reference' }),
    honoFallbackRoutes(honoApp)
  ).pipe(Layer.provide(CorsLive), Layer.provide(HttpServer.layerServices))

  return HttpRouter.toWebHandler(routes, { disableLogger: true })
}
