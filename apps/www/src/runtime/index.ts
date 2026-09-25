import { SpotifyBrowser } from '@spotify-effect/browser'
import { Data, Effect, Layer, Scope } from 'effect'
import { VITE_SPOTIFY_CLIENT_ID } from '$app/env/public'
import { getSpotifyRedirectUri } from '@/lib/spotify-pkce'
import { NoopAnalyticsLayer } from '@/services/analytics/noop'
import { type Analytics } from '@/services/analytics/service'
import { ImageExport, ImageExportLive } from '@/services/image-export'
import { type MediaSessionService, MediaSessionServiceLayer } from '@/services/media-session'
import { PlayerStorage, type PersistedQueueType } from '@gbfm/player'
import { PlayerStorageLive } from '@/services/player/storage'
import { NoopLogger } from '@/services/logger/noop'
import { type Logger } from '@/services/logger/service'
import { type MixUploadDraftStorage, MixUploadDraftStorageLive } from '@/services/mix-upload-draft'
import {
  type ResumableUploadStorage,
  ResumableUploadStorageLive
} from '@/services/resumable-upload'

const spotifyLayer = Layer.suspend(() =>
  SpotifyBrowser.layer({
    clientId: VITE_SPOTIFY_CLIENT_ID ?? '',
    redirectUri: getSpotifyRedirectUri(),
    session: {
      sessionStorage: window.sessionStorage,
      localStorage: window.localStorage,
      history: window.history
    }
  })
)

const playerStorageLayer = PlayerStorageLive
const mediaSessionLayer = MediaSessionServiceLayer
const imageExportLayer = ImageExportLive
const resumableUploadStorageLayer = ResumableUploadStorageLive
const mixUploadDraftStorageLayer = MixUploadDraftStorageLive

const mainLayer = Layer.mergeAll(
  NoopAnalyticsLayer,
  spotifyLayer,
  playerStorageLayer,
  mediaSessionLayer,
  imageExportLayer,
  resumableUploadStorageLayer,
  mixUploadDraftStorageLayer,
  NoopLogger
)

type AppServices =
  | Analytics
  | SpotifyBrowser
  | PlayerStorage
  | MediaSessionService
  | ImageExport
  | ResumableUploadStorage
  | MixUploadDraftStorage
  | Logger

class AppEffectFailure extends Data.TaggedError('AppEffectFailure')<{
  readonly cause: unknown
}> {}

const appScope = Scope.makeUnsafe()
const makeAppContext = () => Effect.runPromise(Layer.buildWithScope(mainLayer, appScope))
let appContextPromise: ReturnType<typeof makeAppContext> | undefined
const getAppContext = () => (appContextPromise ??= makeAppContext())

export const runAppEffect = <A, E>(effect: Effect.Effect<A, E, AppServices>) =>
  getAppContext()
    .then((context) => Effect.runPromiseWith(context)(effect))
    .catch((error) => {
      console.error('App effect failed', error)
      throw error
    })

export const RuntimeClient = {
  runPromise: runAppEffect
}

const useStorage = <A, E>(
  operation: (storage: PlayerStorage['Service']) => Effect.Effect<A, E>
): Effect.Effect<A, AppEffectFailure> =>
  Effect.tryPromise({
    try: () => runAppEffect(Effect.flatMap(PlayerStorage, operation)),
    catch: (cause) => new AppEffectFailure({ cause })
  })

/** Queue persistence bound to the app context for consumers outside a component runtime. */
export const queuePersistence = {
  loadQueue: () => useStorage((storage) => storage.loadQueue),
  saveQueue: (queue: PersistedQueueType) => useStorage((storage) => storage.saveQueue(queue))
}
