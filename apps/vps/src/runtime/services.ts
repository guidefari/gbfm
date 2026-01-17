import { Context, Layer } from 'effect'
import { db } from '@/db'
import { AudioServiceLive } from '@/services/audio.service'
import { EmailServiceLive } from '@/services/email.service'
import { FavoriteServiceLive } from '@/services/favorite.service'
import { LabelServiceLive } from '@/services/label.service'
import { MusicReminderServiceLive } from '@/services/music-reminder.service'
import { PostServiceLive } from '@/services/post.service'
import { ReleaseServiceLive } from '@/services/release.service'
import { SpotifyServiceLive } from '@/services/spotify.service'

export interface DatabaseService {
  readonly db: typeof db
}

export const DatabaseService =
  Context.GenericTag<DatabaseService>('DatabaseService')

export const DatabaseServiceLive = Layer.succeed(DatabaseService, {
  db
})

export const AppLayer = Layer.mergeAll(
  DatabaseServiceLive,
  EmailServiceLive,
  FavoriteServiceLive,
  SpotifyServiceLive,
  MusicReminderServiceLive,
  AudioServiceLive,
  PostServiceLive,
  LabelServiceLive,
  ReleaseServiceLive
)
