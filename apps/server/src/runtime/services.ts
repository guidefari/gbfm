import { Layer } from 'effect'
import { OtelTracer } from '@effect/opentelemetry'
import { Database } from '@/db/layer'
import { AuthLive } from '@/lib/auth'
import { MdxServiceLayer } from '@/lib/mdx'
import type { SentryService } from '@/services/sentry.service'
import { SitemapCache } from '@/services/sitemap-cache'

export { Database, DatabaseLayer } from '@/db/layer'

import { AudioServiceLayer } from '@/services/audio.service'
import { ConfigServiceLayer } from '@/services/config.service'
import { BlueskyAccountServiceLayer } from '@/services/bluesky-account.service'
import { BlueskyArchiveServiceLayer } from '@/services/bluesky-archive.service'
import { BlueskyClientLayer } from '@/services/bluesky-client.service'
import { BlueskyImportServiceLayer } from '@/services/bluesky-importer.service'
import { BlueskyRunsServiceLayer } from '@/services/bluesky-runs.service'
import { BlueskySyncServiceLayer } from '@/services/bluesky-sync.service'
import { LockServiceLayer } from '@/services/lock.service'
import { CryptoServiceLayer } from '@/services/crypto.service'
import { EmailServiceLayer } from '@/services/email.service'
import { FavoriteServiceLayer } from '@/services/favorite.service'
import { AppLoggerLive } from '@/services/logger.service'
import { MusicEntityServiceLayer } from '@/services/music-entity'
import { MusicLinkScraperServiceLayer } from '@/services/music-link-scraper.service'
import { MusicReminderServiceLayer } from '@/services/music-reminder.service'
import { NavigationRetentionServiceLayer } from '@/services/navigation-retention.service'
import { type NavigationLock } from '@/services/navigation-lock'
import { type SpotifyImportResolver } from '@/services/spotify-import-resolver.service'
import { NavigationSessionServiceLayer } from '@/services/navigation.service'
import { PostServiceLayer } from '@/services/post.service'
import { ProfileServiceLayer } from '@/services/profile.service'
import { QRCodeServiceLayer } from '@/services/qrcode.service'
import { ReleaseServiceLayer } from '@/services/release.service'
import { ReminderSignalServiceLayer } from '@/services/reminder-signal.service'
import { ResolveServiceLayer } from '@/services/resolve.service'
import { S3ServiceLayer } from '@/services/s3.service'
import { SearchServiceLayer } from '@/services/search.service'
import { ShowServiceLayer, ShowSubscriptionServiceLayer } from '@/services/show.service'
import { SpotifyServiceLayer } from '@/services/spotify.service'
import { UploadAssetServiceLayer } from '@/services/upload-asset.service'
import { UserServiceLayer } from '@/services/user.service'
import { ObjectStoreClientLayer } from '@/services/storage/object-store-client'

const DevToolsLive: Layer.Layer<never> = Layer.empty

const UploadAssetDepsLive = Layer.mergeAll(ConfigServiceLayer, UploadAssetServiceLayer)
const ObjectStoreClientLive = ObjectStoreClientLayer.pipe(Layer.provide(ConfigServiceLayer))

// Takes the Database, SitemapCache, coordination, Sentry, and Effect-tracing layers as
// parameters instead of building them from module-scope bindings: Bun and
// the Worker initialize Sentry and OpenTelemetry differently (@sentry/bun
// vs @sentry/cloudflare, which cannot share a module -- see
// sentry-client.service.ts and worker.ts), and the composition seam is the
// only place that may choose between them.
export const AppLayer = (
  databaseLive: Layer.Layer<Database>,
  sitemapCacheLive: Layer.Layer<SitemapCache>,
  navigationLockLive: Layer.Layer<NavigationLock>,
  spotifyImportResolverLive: Layer.Layer<SpotifyImportResolver, never, Database>,
  sentryLive: Layer.Layer<SentryService>,
  tracingLive: Layer.Layer<OtelTracer.OtelTracer>
) => {
  const BaseServicesLayer = Layer.mergeAll(
    ConfigServiceLayer,
    BlueskyClientLayer,
    BlueskyImportServiceLayer,
    LockServiceLayer,
    CryptoServiceLayer.pipe(Layer.provide(ConfigServiceLayer)),
    EmailServiceLayer,
    FavoriteServiceLayer,
    SpotifyServiceLayer,
    MusicReminderServiceLayer,
    NavigationRetentionServiceLayer,
    spotifyImportResolverLive,
    NavigationSessionServiceLayer.pipe(
      Layer.provide(
        PostServiceLayer.pipe(Layer.provide(MdxServiceLayer), Layer.provide(UploadAssetDepsLive))
      ),
      Layer.provide(navigationLockLive)
    ),
    ReminderSignalServiceLayer,
    MusicLinkScraperServiceLayer.pipe(Layer.provide(SpotifyServiceLayer)),
    AudioServiceLayer.pipe(Layer.provide(MdxServiceLayer), Layer.provide(UploadAssetDepsLive)),
    PostServiceLayer.pipe(Layer.provide(MdxServiceLayer), Layer.provide(UploadAssetDepsLive)),
    ProfileServiceLayer,
    ResolveServiceLayer,
    ReleaseServiceLayer,
    S3ServiceLayer.pipe(Layer.provide(Layer.mergeAll(ObjectStoreClientLive, ConfigServiceLayer))),
    SearchServiceLayer,
    sentryLive,
    tracingLive,
    ShowServiceLayer,
    ShowSubscriptionServiceLayer,
    UploadAssetServiceLayer,
    UserServiceLayer,
    DevToolsLive
  ).pipe(Layer.provide(databaseLive))

  const MusicEntityLive = MusicEntityServiceLayer.pipe(Layer.provide(BaseServicesLayer))
  const BlueskyArchiveLive = BlueskyArchiveServiceLayer.pipe(
    Layer.provide(Layer.mergeAll(BaseServicesLayer, MusicEntityLive))
  )
  const BlueskySyncLive = BlueskySyncServiceLayer.pipe(
    Layer.provide(Layer.mergeAll(BaseServicesLayer, MusicEntityLive, BlueskyArchiveLive))
  )

  const ServicesLayer = Layer.mergeAll(
    BaseServicesLayer,
    QRCodeServiceLayer.pipe(Layer.provide(BaseServicesLayer)),
    MusicEntityLive,
    BlueskyAccountServiceLayer.pipe(Layer.provide(BaseServicesLayer)),
    BlueskyArchiveLive,
    BlueskyRunsServiceLayer.pipe(Layer.provide(databaseLive)),
    BlueskySyncLive
  ).pipe(Layer.provide(databaseLive))

  return Layer.mergeAll(
    ServicesLayer,
    databaseLive,
    sitemapCacheLive,
    AuthLive.pipe(Layer.provide(databaseLive))
  ).pipe(Layer.provideMerge(AppLoggerLive))
}
