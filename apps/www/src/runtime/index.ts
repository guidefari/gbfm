import { SpotifyBrowser } from '@spotify-effect/browser'
import { Effect, Layer, Scope } from 'effect'
import { env } from '@/env'
import { getSpotifyRedirectUri } from '@/lib/spotify-pkce'
import { type Analytics, SentryAnalyticsLayer, NoopAnalyticsLayer } from '@/services/analytics'
import {
  type AudioStorage,
  AudioStorageLive,
  type MediaSessionService,
  MediaSessionServiceLive
} from '@/services/audio-player'
import { log, type Logger, LoggerLive, NoopLogger } from '@/services/logger'
import { SentryTracerLive } from '@/services/sentry-tracer'
import { type MixUploadDraftStorage, MixUploadDraftStorageLive } from '@/services/mix-upload-draft'
import {
  type ResumableUploadStorage,
  ResumableUploadStorageLive
} from '@/services/resumable-upload'

const enableSentry = Boolean(env.sentryDsn) && (!env.isDev || env.sentryEnableLocal)

const analyticsLayer = enableSentry ? SentryAnalyticsLayer : NoopAnalyticsLayer

const spotifyLayer = Layer.suspend(() =>
  SpotifyBrowser.layer({
    clientId: env.spotifyClientId,
    redirectUri: getSpotifyRedirectUri(),
    session: {
      sessionStorage: window.sessionStorage,
      localStorage: window.localStorage,
      history: window.history
    }
  })
)

const audioStorageLayer = AudioStorageLive
const mediaSessionLayer = MediaSessionServiceLive
const resumableUploadStorageLayer = ResumableUploadStorageLive
const mixUploadDraftStorageLayer = MixUploadDraftStorageLive
const loggerLayer = enableSentry ? LoggerLive : NoopLogger
const tracerLayer = enableSentry ? SentryTracerLive : Layer.empty

const mainLayer = Layer.mergeAll(
  analyticsLayer,
  spotifyLayer,
  audioStorageLayer,
  mediaSessionLayer,
  resumableUploadStorageLayer,
  mixUploadDraftStorageLayer,
  loggerLayer,
  tracerLayer
)

type AppServices =
  | Analytics
  | SpotifyBrowser
  | AudioStorage
  | MediaSessionService
  | ResumableUploadStorage
  | MixUploadDraftStorage
  | Logger

const appScope = Scope.makeUnsafe()
const appContextPromise = Effect.runPromise(Layer.buildWithScope(mainLayer, appScope))

export const runAppEffect = <A, E>(effect: Effect.Effect<A, E, AppServices>) =>
  appContextPromise
    .then((context) => Effect.runPromiseWith(context)(effect))
    .catch((error) => {
      log('error', 'App effect failed', { error })
      throw error
    })

export const RuntimeClient = {
  runPromise: runAppEffect
}
