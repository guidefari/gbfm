import { VITE_SPOTIFY_CLIENT_ID } from '$app/env/public'
import { SpotifyBrowser } from '@spotify-effect/browser'
import { type Effect, Layer, ManagedRuntime } from 'effect'

import { getSpotifyRedirectUri } from '@/lib/spotify-pkce'
import { type ImageExport, ImageExportLive } from '@/services/image-export'
import { log } from '@/services/logger'
import { type MixUploadDraftStorage, MixUploadDraftStorageLive } from '@/services/mix-upload-draft'
import {
  type ResumableUploadStorage,
  ResumableUploadStorageLive,
} from '@/services/resumable-upload'

const spotifyLayer = Layer.suspend(() =>
  SpotifyBrowser.layer({
    clientId: VITE_SPOTIFY_CLIENT_ID ?? '',
    redirectUri: getSpotifyRedirectUri(),
    session: {
      sessionStorage: window.sessionStorage,
      localStorage: window.localStorage,
      history: window.history,
    },
  }),
)

const imageExportLayer = ImageExportLive

const resumableUploadStorageLayer = ResumableUploadStorageLive

const mixUploadDraftStorageLayer = MixUploadDraftStorageLive

const mainLayer = Layer.mergeAll(
  spotifyLayer,
  imageExportLayer,
  resumableUploadStorageLayer,
  mixUploadDraftStorageLayer,
)

type AppServices = SpotifyBrowser | ImageExport | ResumableUploadStorage | MixUploadDraftStorage

const appRuntime = ManagedRuntime.make(mainLayer)

if (import.meta.hot) {
  import.meta.hot.dispose(() => void appRuntime.dispose())
}

export const runAppEffect = <A, E>(effect: Effect.Effect<A, E, AppServices>) =>
  appRuntime.runPromise(effect).catch((error) => {
    log('error', 'App effect failed', { error })
    throw error
  })
