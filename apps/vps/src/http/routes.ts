import * as BunFileSystem from '@effect/platform-bun/BunFileSystem'
import * as BunPath from '@effect/platform-bun/BunPath'
import { Api } from '@gbfm/api/api'
import type { ReadinessCheckFailedError } from '@gbfm/api/errors'
import { Effect, Layer } from 'effect'
import { HttpRouter, HttpServer, HttpServerRequest, HttpServerResponse } from 'effect/unstable/http'
import { HttpApiBuilder } from 'effect/unstable/httpapi'
import { AdminHandlersLive } from '@/http/admin.handlers'
import { AudioHandlersLive } from '@/http/audio.handlers'
import { BlueskyHandlersLive } from '@/http/bluesky.handlers'
import { BlueskyEventsRoute } from '@/http/bluesky-events.routes'
import { EmailHandlersLive } from '@/http/email.handlers'
import { FavoritesHandlersLive } from '@/http/favorites.handlers'
import { FileManagerHandlersLive } from '@/http/file-manager.handlers'
import {
  CorsLive,
  RateLimiterLive,
  RequestLoggerLive,
  SentryDefectLive
} from '@/http/global-middleware'
import { checkDatabase, makeHealthHandlers } from '@/http/health.handlers'
import { DocsLive } from '@/http/docs'
import { InviteHandlersLive } from '@/http/invite.handlers'
import { InternalHandlersLive } from '@/http/internal.handlers'
import { MusicHandlersLive } from '@/http/music.handlers'
import { MusicRemindersHandlersLive } from '@/http/music-reminders.handlers'
import { NavigationHandlersLive } from '@/http/navigation.handlers'
import { NewsletterHandlersLive } from '@/http/newsletter.handlers'
import { PostHandlersLive } from '@/http/post.handlers'
import { ProfileHandlersLive } from '@/http/profile.handlers'
import { ReleaseHandlersLive } from '@/http/release.handlers'
import { ResolveHandlersLive } from '@/http/resolve.handlers'
import { SearchHandlersLive } from '@/http/search.handlers'
import { SearchCacheHeaderLive } from '@/http/search.middleware'
import { ShowsHandlersLive } from '@/http/shows.handlers'
import { SiteRoutesLive } from '@/http/site-routes'
import { SpotifyHandlersLive } from '@/http/spotify.handlers'
import { UploadHandlersLive } from '@/http/upload.handlers'
import { UserHandlersLive } from '@/http/user.handlers'
import { Auth } from '@/lib/auth'
import { AuthMiddlewareLive } from '@/middleware/auth.impl'
import { IdentityResolverLive } from '@/middleware/optional-auth.impl'
import { prepareAuthRequest } from '@/routes/user/better-auth.routes'
import { appServicesContext } from '@/runtime'
import { AppLoggerLive } from '@/services/logger.service'

// Reuses the app's already-built service instances (DB pool, S3 client, ...)
// instead of Layer.provide(AppLayer), which would build a second, independent
// copy of every singleton service.
const AppServicesLive = Layer.effectContext(appServicesContext)

// better-auth owns its own routing; we can't redefine it as HttpApiEndpoints. Kept at
// its own path (not under /api) since its basePath appears in emailed links.
const betterAuthRoute = HttpRouter.add('*', '/auth/*', (request) =>
  Effect.gen(function* () {
    const auth = yield* Auth
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
//
// Step 8: the Hono app is gone entirely -- this function used to take a
// `honoApp: AppType` parameter to build a wildcard fallback route
// (docs/migration-effect-http-api.md's incremental-migration strategy); the
// fallback was removed once app.ts had zero remaining route mounts left to
// forward to, and the parameter itself is gone now that nothing references
// AppType anywhere in this file or its callers.
export const createWebHandler = (options?: {
  readonly healthDatabaseCheck?: Effect.Effect<void, ReadinessCheckFailedError>
  readonly appServicesLive?: typeof AppServicesLive
}) => {
  const appServices = options?.appServicesLive ?? AppServicesLive
  const ApiLive = HttpApiBuilder.layer(Api).pipe(
    Layer.provide(makeHealthHandlers(options?.healthDatabaseCheck ?? checkDatabase)),
    Layer.provide(InternalHandlersLive),
    Layer.provide(MusicHandlersLive),
    Layer.provide(SearchHandlersLive),
    Layer.provide(ProfileHandlersLive),
    Layer.provide(ResolveHandlersLive),
    Layer.provide(AdminHandlersLive),
    Layer.provide(InviteHandlersLive),
    Layer.provide(ReleaseHandlersLive),
    Layer.provide(PostHandlersLive),
    Layer.provide(AudioHandlersLive),
    Layer.provide(BlueskyHandlersLive),
    Layer.provide(EmailHandlersLive),
    Layer.provide(
      Layer.mergeAll(
        FavoritesHandlersLive,
        MusicRemindersHandlersLive,
        NavigationHandlersLive,
        NewsletterHandlersLive
      )
    ),
    Layer.provide(FileManagerHandlersLive),
    Layer.provide(SpotifyHandlersLive),
    Layer.provide(ShowsHandlersLive),
    Layer.provide(Layer.mergeAll(UserHandlersLive, UploadHandlersLive)),
    // These middleware services are also yielded directly by built handlers. Keep them in the
    // layer output so toWebHandler can prove no request-time context remains.
    Layer.provideMerge(Layer.mergeAll(AuthMiddlewareLive, IdentityResolverLive))
  )

  return HttpRouter.toWebHandler(
    // Global-middleware order here is load-bearing but NOT contractually
    // guaranteed by Layer.mergeAll -- each HttpRouter.middleware(fn, {global:
    // true}) registers into a shared Set via Layer.effectDiscard, and
    // mergeAll builds member layers concurrently with no documented ordering.
    // It works today (verified: an OPTIONS preflight through this exact
    // composition returns CORS headers with no x-ratelimit-* header, proving
    // CorsLive's short-circuit runs before RateLimiterLive's httpEffect ever
    // executes) only because none of these four middleware bodies suspend
    // before their first yield, so Effect's scheduler happens to run them in
    // array order. Adding a real async gap to any of them, or an Effect
    // version change to mergeAll's build strategy, could silently reorder
    // this. If CORS ever stops short-circuiting rate-limiting for OPTIONS
    // requests, check this ordering first.
    Layer.mergeAll(
      ApiLive,
      betterAuthRoute,
      BlueskyEventsRoute,
      SearchCacheHeaderLive,
      SiteRoutesLive,
      DocsLive,
      CorsLive,
      RateLimiterLive,
      RequestLoggerLive,
      SentryDefectLive
    ).pipe(
      Layer.provideMerge(appServices),
      // RequestLoggerLive is the single structured request event; disable
      // Effect HttpMiddleware.logger to avoid a second response log line.
      Layer.provide(HttpRouter.disableLogger),
      // HttpServerRequest.multipart (user group's updateProfile avatar
      // upload, see user.handlers.ts's uploadAvatar) needs a real
      // FileSystem.FileSystem + Path.Path to buffer parts to temp files.
      // The upload group's own endpoints are presign-based now (no more
      // uploadMultipartPart/uploadFile multipart proxies) and don't need
      // this, but user.handlers.ts still does. HttpServer.layerServices
      // ships its own FileSystem.layerNoop, so the real Bun implementation
      // is nested inside the same provideMerge, applied after layerServices,
      // so it overwrites the noop instead of losing to it. Confirmed by
      // reproducing the "not implemented" multipart defect from the noop
      // FileSystem and watching it disappear with this composition.
      Layer.provideMerge(
        Layer.mergeAll(BunFileSystem.layer, BunPath.layer).pipe(
          Layer.provideMerge(HttpServer.layerServices)
        )
      ),
      // Effect.logError inside health handlers must reach the app's real
      // Pino + Sentry logger, not Effect's bare default console logger --
      // otherwise a DB outage's cause is logged nowhere on-call looks.
      Layer.provideMerge(AppLoggerLive)
    ),
    { disableLogger: true }
  )
}
