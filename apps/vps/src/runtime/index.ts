import { type Context, Effect, Exit, Layer, Scope } from 'effect'
import type { AudioService } from '@/services/audio.service'
import type { ConfigService } from '@/services/config.service'
import type { EmailService } from '@/services/email.service'
import type { FavoriteService } from '@/services/favorite.service'
import type { LabelService } from '@/services/label.service'
import type { MixProcessingService } from '@/services/mix-processing.service'
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
import type { SentryService } from '@/services/sentry.service'
import type {
  ShowService,
  ShowSubscriptionService
} from '@/services/show.service'
import type { SpotifyService } from '@/services/spotify.service'
import type { UserService } from '@/services/user.service'
import type { DatabaseService } from './services'
import { AppLayer } from './services'

type AppServices =
  | ConfigService
  | DatabaseService
  | EmailService
  | FavoriteService
  | SpotifyService
  | MusicReminderService
  | ReminderSignalService
  | MusicLinkScraperService
  | MusicEntityService
  | AudioService
  | PostService
  | LabelService
  | ProfileService
  | QRCodeService
  | ReleaseService
  | ResolveService
  | S3Service
  | SentryService
  | ShowService
  | ShowSubscriptionService
  | MixProcessingService
  | UserService

let appContext: Context.Context<AppServices> | undefined

const appScope = Scope.makeUnsafe()

const appContextPromise = Effect.runPromise(
  Layer.buildWithScope(AppLayer, appScope)
).then((context) => {
  appContext = context
  return context
})

export const AppRuntime = {
  runPromise: <A, E, R extends AppServices>(effect: Effect.Effect<A, E, R>) =>
    appContextPromise.then((context) => Effect.runPromiseWith(context)(effect)),
  runPromiseExit: <A, E, R extends AppServices>(
    effect: Effect.Effect<A, E, R>
  ) =>
    appContextPromise.then((context) =>
      Effect.runPromiseExitWith(context)(effect)
    ),
  runSync: <A, E, R extends AppServices>(effect: Effect.Effect<A, E, R>) => {
    if (!appContext) {
      throw new Error('App runtime context is not initialized')
    }

    return Effect.runSyncWith(appContext)(effect)
  },
  runFork: <A, E, R extends AppServices>(effect: Effect.Effect<A, E, R>) =>
    appContextPromise.then((context) => Effect.runForkWith(context)(effect)),
  dispose: () => Effect.runPromise(Scope.close(appScope, Exit.void))
}

export const runApp = <A, E, R extends AppServices>(
  effect: Effect.Effect<A, E, R>
) => AppRuntime.runPromise(effect)

export const runAppSync = <A, E, R extends AppServices>(
  effect: Effect.Effect<A, E, R>
) => AppRuntime.runSync(effect)

export const runAppFork = <A, E, R extends AppServices>(
  effect: Effect.Effect<A, E, R>
) => AppRuntime.runFork(effect)

export const disposeRuntime = () => AppRuntime.dispose()
