import { type Effect, ManagedRuntime } from 'effect'
import type { AudioService } from '@/services/audio.service'
import type { EmailService } from '@/services/email.service'
import type { FavoriteService } from '@/services/favorite.service'
import type { LabelService } from '@/services/label.service'
import type { MusicReminderService } from '@/services/music-reminder.service'
import type { PostService } from '@/services/post.service'
import type { ReleaseService } from '@/services/release.service'
import type { SpotifyService } from '@/services/spotify.service'
import type { DatabaseService } from './services'
import { AppLayer } from './services'

type AppServices =
  | DatabaseService
  | EmailService
  | FavoriteService
  | SpotifyService
  | MusicReminderService
  | AudioService
  | PostService
  | LabelService
  | ReleaseService

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
