import { SpotifyBrowser } from '@spotify-effect/browser'
import { Effect, Layer, Scope } from 'effect'
import { VITE_SPOTIFY_CLIENT_ID } from '$app/env/public'
import { getSpotifyRedirectUri } from '@/lib/spotify-pkce'
import { ImageExport, ImageExportLive } from '@/services/image-export'
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

const imageExportLayer = ImageExportLive
const resumableUploadStorageLayer = ResumableUploadStorageLive
const mixUploadDraftStorageLayer = MixUploadDraftStorageLive

const mainLayer = Layer.mergeAll(
  spotifyLayer,
  imageExportLayer,
  resumableUploadStorageLayer,
  mixUploadDraftStorageLayer
)

type AppServices =
  | SpotifyBrowser
  | ImageExport
  | ResumableUploadStorage
  | MixUploadDraftStorage

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
