import { type Effect, ManagedRuntime } from 'effect'
import type { AudioService } from '@/services/audio.service'
import type { ConfigService } from '@/services/config.service'
import type { EmailService } from '@/services/email.service'
import type { FavoriteService } from '@/services/favorite.service'
import type { LabelService } from '@/services/label.service'
import type { MusicReminderService } from '@/services/music-reminder.service'
import type { PostService } from '@/services/post.service'
import type { ProfileService } from '@/services/profile.service'
import type { PublicationService } from '@/services/publication.service'
import type { QRCodeService } from '@/services/qrcode.service'
import type { ReleaseService } from '@/services/release.service'
import type { ResolveService } from '@/services/resolve.service'
import type { S3Service } from '@/services/s3.service'
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
  | AudioService
  | PostService
  | LabelService
  | ProfileService
  | PublicationService
  | QRCodeService
  | ReleaseService
  | ResolveService
  | S3Service
  | ShowService
  | ShowSubscriptionService
  | UserService

export const AppRuntime = ManagedRuntime.make(AppLayer)

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
