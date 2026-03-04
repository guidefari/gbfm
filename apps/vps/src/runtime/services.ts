import { DevTools } from '@effect/experimental'
import { Context, Layer } from 'effect'
import { db } from '@/db'
import { OtlpLive } from '@/lib/otel'
import { LoggerServiceLive } from '@/middlewares/effect-logger'
import { AudioServiceLive } from '@/services/audio.service'
import { ConfigServiceLive } from '@/services/config.service'
import { EmailServiceLive } from '@/services/email.service'
import { FavoriteServiceLive } from '@/services/favorite.service'
import { LabelServiceLive } from '@/services/label.service'
import { MixProcessingServiceLayer } from '@/services/mix-processing.service'
import { MusicEntityServiceLive } from '@/services/music-entity.service'
import { MusicLinkScraperServiceLive } from '@/services/music-link-scraper.service'
import { MusicReminderServiceLive } from '@/services/music-reminder.service'
import { PostServiceLive } from '@/services/post.service'
import { ProfileServiceLive } from '@/services/profile.service'
import { QRCodeServiceLive } from '@/services/qrcode.service'
import { ReleaseServiceLive } from '@/services/release.service'
import { ReminderSignalServiceLive } from '@/services/reminder-signal.service'
import { ResolveServiceLive } from '@/services/resolve.service'
import { S3ServiceLive } from '@/services/s3.service'
import {
  ShowServiceLive,
  ShowSubscriptionServiceLive
} from '@/services/show.service'
import { SpotifyServiceLive } from '@/services/spotify.service'
import { UserServiceLive } from '@/services/user.service'

export interface DatabaseService {
  readonly db: typeof db
}

export const DatabaseService =
  Context.GenericTag<DatabaseService>('DatabaseService')

export const DatabaseServiceLive = Layer.succeed(DatabaseService, {
  db
})

const DevToolsLive: Layer.Layer<never> =
  process.env.NODE_ENV === 'production' ? Layer.empty : DevTools.layer()

const BaseServicesLayer = Layer.mergeAll(
  ConfigServiceLive,
  DatabaseServiceLive,
  LoggerServiceLive,
  EmailServiceLive,
  FavoriteServiceLive,
  SpotifyServiceLive,
  MusicReminderServiceLive,
  ReminderSignalServiceLive,
  MusicLinkScraperServiceLive,
  AudioServiceLive,
  PostServiceLive,
  LabelServiceLive,
  ProfileServiceLive,
  ResolveServiceLive,
  ReleaseServiceLive,
  S3ServiceLive,
  ShowServiceLive,
  ShowSubscriptionServiceLive,
  UserServiceLive,
  DevToolsLive
)

const ServicesLayer = Layer.mergeAll(
  BaseServicesLayer,
  QRCodeServiceLive.pipe(Layer.provide(BaseServicesLayer)),
  MixProcessingServiceLayer.pipe(Layer.provide(BaseServicesLayer)),
  MusicEntityServiceLive.pipe(Layer.provide(BaseServicesLayer))
)

export const AppLayer = ServicesLayer.pipe(Layer.provide(OtlpLive))
