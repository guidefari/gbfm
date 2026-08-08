import { Layer } from 'effect'
import { MdxServiceLayer } from '@/lib/mdx'
import { OtlpLive } from '@/lib/otel'
import { DatabaseServiceLayer } from '@/services/database.service'

export { DatabaseService, DatabaseServiceLayer } from '@/services/database.service'

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
import { NavigationSessionServiceLayer } from '@/services/navigation.service'
import { PostServiceLayer } from '@/services/post.service'
import { ProfileServiceLayer } from '@/services/profile.service'
import { QRCodeServiceLayer } from '@/services/qrcode.service'
import { ReleaseServiceLayer } from '@/services/release.service'
import { ReminderSignalServiceLayer } from '@/services/reminder-signal.service'
import { ResolveServiceLayer } from '@/services/resolve.service'
import { S3ServiceLayer } from '@/services/s3.service'
import { SearchServiceLayer } from '@/services/search.service'
import { SentryServiceLayer } from '@/services/sentry.service'
import { SentryClientServiceLayer } from '@/services/sentry-client.service'
import { ShowServiceLayer, ShowSubscriptionServiceLayer } from '@/services/show.service'
import { SpotifyServiceLayer } from '@/services/spotify.service'
import { UploadAssetServiceLayer } from '@/services/upload-asset.service'
import { UserServiceLayer } from '@/services/user.service'

const DevToolsLive: Layer.Layer<never> = Layer.empty

const SentryClientLive = SentryClientServiceLayer.pipe(Layer.provide(ConfigServiceLayer))

const UploadAssetDepsLive = Layer.mergeAll(ConfigServiceLayer, UploadAssetServiceLayer)

const BaseServicesLayer = Layer.mergeAll(
  ConfigServiceLayer,
  BlueskyClientLayer,
  BlueskyImportServiceLayer,
  LockServiceLayer,
  CryptoServiceLayer.pipe(Layer.provide(ConfigServiceLayer)),
  DatabaseServiceLayer,
  EmailServiceLayer,
  FavoriteServiceLayer,
  SpotifyServiceLayer,
  MusicReminderServiceLayer,
  NavigationRetentionServiceLayer.pipe(Layer.provide(DatabaseServiceLayer)),
  NavigationSessionServiceLayer,
  ReminderSignalServiceLayer,
  MusicLinkScraperServiceLayer.pipe(Layer.provide(SpotifyServiceLayer)),
  AudioServiceLayer.pipe(Layer.provide(MdxServiceLayer), Layer.provide(UploadAssetDepsLive)),
  PostServiceLayer.pipe(Layer.provide(MdxServiceLayer), Layer.provide(UploadAssetDepsLive)),
  ProfileServiceLayer,
  ResolveServiceLayer,
  ReleaseServiceLayer,
  S3ServiceLayer,
  SearchServiceLayer,
  SentryServiceLayer.pipe(Layer.provide(SentryClientLive)),
  OtlpLive.pipe(Layer.provide(SentryClientLive), Layer.provide(ConfigServiceLayer)),
  ShowServiceLayer,
  ShowSubscriptionServiceLayer,
  UploadAssetServiceLayer,
  UserServiceLayer,
  DevToolsLive
)

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
  BlueskyRunsServiceLayer,
  BlueskySyncLive
)

export const AppLayer = ServicesLayer.pipe(Layer.provideMerge(AppLoggerLive))
