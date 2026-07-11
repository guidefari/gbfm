import { Api } from '@gbfm/api/api'
import type { ReadinessCheckFailedError } from '@gbfm/api/errors'
import { Effect, Layer } from 'effect'
import { HttpRouter, HttpServer, HttpServerRequest, HttpServerResponse } from 'effect/unstable/http'
import { HttpApiBuilder } from 'effect/unstable/httpapi'
import type { AppType } from '@/app'
import { AdminHandlersLive } from '@/http/admin.handlers'
import { FavoritesHandlersLive } from '@/http/favorites.handlers'
import { FileManagerHandlersLive } from '@/http/file-manager.handlers'
import { checkDatabase, makeHealthHandlers } from '@/http/health.handlers'
import { InviteHandlersLive } from '@/http/invite.handlers'
import { InternalHandlersLive } from '@/http/internal.handlers'
import { MusicHandlersLive } from '@/http/music.handlers'
import { NewsletterHandlersLive } from '@/http/newsletter.handlers'
import { ProfileHandlersLive } from '@/http/profile.handlers'
import { ResolveHandlersLive } from '@/http/resolve.handlers'
import { SearchHandlersLive } from '@/http/search.handlers'
import { SearchCacheHeaderLive } from '@/http/search.middleware'
import { SpotifyHandlersLive } from '@/http/spotify.handlers'
import { auth } from '@/lib/auth'
import { AuthMiddlewareLive } from '@/middleware/auth.impl'
import { prepareAuthRequest } from '@/routes/user/better-auth.routes'
import { appServicesContext } from '@/runtime'
import { AppLoggerLive } from '@/services/logger.service'

// Reuses the app's already-built service instances (DB pool, S3 client, ...)
// instead of Layer.provide(AppLayer), which would build a second, independent
// copy of every singleton service.
const AppServicesLive = Layer.effectContext(appServicesContext)

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

// Step 3a/3b (docs/migration-effect-http-api.md): real HttpApi groups taking
// over live traffic from the Hono fallback. Test seams accept an alternate
// database check so tests can force the failure/cache paths. `internal` has
// no production client -- it exists to validate AuthMiddleware in isolation
// before any real authed route (step 4+) depends on it.
export const createWebHandler = (
  honoApp: AppType,
  options?: { readonly healthDatabaseCheck?: Effect.Effect<void, ReadinessCheckFailedError> }
) => {
  const ApiLive = HttpApiBuilder.layer(Api).pipe(
    Layer.provide(makeHealthHandlers(options?.healthDatabaseCheck ?? checkDatabase)),
    Layer.provide(InternalHandlersLive),
    Layer.provide(MusicHandlersLive),
    Layer.provide(SearchHandlersLive),
    Layer.provide(ProfileHandlersLive),
    Layer.provide(ResolveHandlersLive),
    Layer.provide(AdminHandlersLive),
    Layer.provide(InviteHandlersLive),
    Layer.provide(FavoritesHandlersLive),
    Layer.provide(NewsletterHandlersLive),
    Layer.provide(FileManagerHandlersLive),
    Layer.provide(SpotifyHandlersLive),
    Layer.provide(AuthMiddlewareLive),
    // provideMerge, not provide: services a handler pulls via plain `yield*`
    // only clear toWebHandler's phantom-context requirement once they're
    // also in this layer's output, which plain `provide` discards.
    Layer.provideMerge(AppServicesLive)
  )

  return HttpRouter.toWebHandler(
    Layer.mergeAll(ApiLive, betterAuthRoute, honoFallback(honoApp), SearchCacheHeaderLive).pipe(
      Layer.provideMerge(HttpServer.layerServices),
      // Effect.logError inside health handlers must reach the app's real
      // Pino + Sentry logger, not Effect's bare default console logger --
      // otherwise a DB outage's cause is logged nowhere on-call looks.
      Layer.provide(AppLoggerLive)
    )
  )
}
