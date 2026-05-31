import { Layer } from 'effect'
import { MdxServiceLive } from '@/lib/mdx'
import { DatabaseServiceLive } from '@/services/database.service'

export { DatabaseService, DatabaseServiceLive } from '@/services/database.service'

import { AudioServiceLive } from '@/services/audio.service'
import { ConfigServiceLive } from '@/services/config.service'
import { EmailServiceLive } from '@/services/email.service'
import { FavoriteServiceLive } from '@/services/favorite.service'
import { LabelServiceLive } from '@/services/label.service'
import { AppLoggerLive } from '@/services/logger.service'
import { MusicEntityServiceLive } from '@/services/music-entity'
import { MusicLinkScraperServiceLive } from '@/services/music-link-scraper.service'
import { MusicReminderServiceLive } from '@/services/music-reminder.service'
import { PostServiceLive } from '@/services/post.service'
import { ProfileServiceLive } from '@/services/profile.service'
import { QRCodeServiceLive } from '@/services/qrcode.service'
import { ReleaseServiceLive } from '@/services/release.service'
import { ReminderSignalServiceLive } from '@/services/reminder-signal.service'
import { ResolveServiceLive } from '@/services/resolve.service'
import { S3ServiceLive } from '@/services/s3.service'
import { SentryServiceLive } from '@/services/sentry.service'
import { SentryClientServiceLive } from '@/services/sentry-client.service'
import { ShowServiceLive, ShowSubscriptionServiceLive } from '@/services/show.service'
import { SpotifyServiceLive } from '@/services/spotify.service'
import { UserServiceLive } from '@/services/user.service'

const DevToolsLive: Layer.Layer<never> = Layer.empty

const SentryClientLive = SentryClientServiceLive.pipe(Layer.provide(ConfigServiceLive))

const BaseServicesLayer = Layer.mergeAll(
  ConfigServiceLive,
  DatabaseServiceLive,
  EmailServiceLive,
  FavoriteServiceLive,
  SpotifyServiceLive,
  MusicReminderServiceLive,
  ReminderSignalServiceLive,
  MusicLinkScraperServiceLive,
  AudioServiceLive.pipe(Layer.provide(MdxServiceLive)),
  PostServiceLive.pipe(Layer.provide(MdxServiceLive)),
  LabelServiceLive,
  ProfileServiceLive,
  ResolveServiceLive,
  ReleaseServiceLive,
  S3ServiceLive,
  SentryServiceLive.pipe(Layer.provide(SentryClientLive)),
  ShowServiceLive,
  ShowSubscriptionServiceLive,
  UserServiceLive,
  DevToolsLive
)

const ServicesLayer = Layer.mergeAll(
  BaseServicesLayer,
  QRCodeServiceLive.pipe(Layer.provide(BaseServicesLayer)),
  MusicEntityServiceLive.pipe(Layer.provide(BaseServicesLayer))
)

export const AppLayer = ServicesLayer.pipe(Layer.provide(AppLoggerLive))
