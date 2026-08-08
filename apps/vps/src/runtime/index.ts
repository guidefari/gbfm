import { Effect, ManagedRuntime } from 'effect'
import type { AudioService } from '@/services/audio.service'
import type { BlueskyAccountService } from '@/services/bluesky-account.service'
import type { BlueskyArchiveService } from '@/services/bluesky-archive.service'
import type { BlueskySyncService } from '@/services/bluesky-sync.service'
import type { ConfigService } from '@/services/config.service'
import type { EmailService } from '@/services/email.service'
import type { FavoriteService } from '@/services/favorite.service'
import type { LockService } from '@/services/lock.service'
import type { MusicEntityService } from '@/services/music-entity'
import type { MusicLinkScraperService } from '@/services/music-link-scraper.service'
import type { MusicReminderService } from '@/services/music-reminder.service'
import type { PostService } from '@/services/post.service'
import type { ProfileService } from '@/services/profile.service'
import type { QRCodeService } from '@/services/qrcode.service'
import type { ReleaseService } from '@/services/release.service'
import type { ReminderSignalService } from '@/services/reminder-signal.service'
import type { ResolveService } from '@/services/resolve.service'
import type { S3Service } from '@/services/s3.service'
import type { SearchService } from '@/services/search.service'
import type { SentryService } from '@/services/sentry.service'
import type { ShowService, ShowSubscriptionService } from '@/services/show.service'
import type { SpotifyService } from '@/services/spotify.service'
import type { UserService } from '@/services/user.service'
import type { Database } from '@/db/layer'
import type { Auth } from '@/lib/auth'
import { AppLayer } from './services'

export type AppServices =
  | ConfigService
  | BlueskyAccountService
  | BlueskyArchiveService
  | BlueskySyncService
  | LockService
  | Database
  | Auth
  | EmailService
  | FavoriteService
  | SpotifyService
  | MusicReminderService
  | ReminderSignalService
  | MusicLinkScraperService
  | MusicEntityService
  | AudioService
  | PostService
  | ProfileService
  | QRCodeService
  | ReleaseService
  | ResolveService
  | S3Service
  | SearchService
  | SentryService
  | ShowService
  | ShowSubscriptionService
  | UserService

const managedRuntime = ManagedRuntime.make(AppLayer)

// The app's built service instances (DB pool, S3 client, etc.) as an Effect,
// for other layer chains (e.g. the Effect HttpApi router in http/routes.ts)
// to reuse via Layer.provideMerge instead of Layer.provide(AppLayer) building
// a second, independent copy of every singleton service.
export const appServicesContext = managedRuntime.contextEffect

export const AppRuntime = {
  runPromise: <A, E, R extends AppServices>(effect: Effect.Effect<A, E, R>) =>
    managedRuntime.runPromise(effect),
  runPromiseExit: <A, E, R extends AppServices>(effect: Effect.Effect<A, E, R>) =>
    managedRuntime.runPromiseExit(effect),
  runSync: <A, E, R extends AppServices>(effect: Effect.Effect<A, E, R>) =>
    managedRuntime.runSync(effect),
  runFork: <A, E, R extends AppServices>(effect: Effect.Effect<A, E, R>) =>
    managedRuntime.runFork(effect),
  dispose: () => managedRuntime.dispose()
}

export const runApp = <A, E, R extends AppServices>(effect: Effect.Effect<A, E, R>) =>
  AppRuntime.runPromise(effect)

export const runAppSync = <A, E, R extends AppServices>(effect: Effect.Effect<A, E, R>) =>
  AppRuntime.runSync(effect)

export const runAppFork = <A, E, R extends AppServices>(effect: Effect.Effect<A, E, R>) =>
  AppRuntime.runFork(effect)

export const disposeRuntime = () => AppRuntime.dispose()
