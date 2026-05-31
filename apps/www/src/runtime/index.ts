import { SpotifyBrowser } from '@spotify-effect/browser'
import { Effect, Layer, Scope } from 'effect'
import { env } from '@/env'
import { getSpotifyRedirectUri } from '@/lib/spotify-pkce'
import { type Analytics, makeSentryAnalyticsLayer, NoopAnalyticsLayer } from '@/services/analytics'
import {
  type AudioStorage,
  AudioStorageLive,
  type MediaSessionService,
  MediaSessionServiceLive
} from '@/services/audio-player'

const enableSentry = Boolean(env.sentryDsn) && (!env.isDev || env.sentryEnableLocal)

const analyticsLayer = enableSentry
  ? makeSentryAnalyticsLayer({
      dsn: env.sentryDsn,
      environment: env.sentryEnvironment ?? (env.isDev ? 'development' : 'production'),
      release: env.sentryRelease,
      debug: env.isDev,
      enableSessionReplay: !env.isDev,
      // temporarily raised to 1.0 for end-to-end trace investigation
      tracesSampleRate: 1.0,
      tracePropagationTargets: env.isDev
        ? ['https://vps.goosebumps.fm', 'http://127.0.0.1:3003', 'http://localhost:3003']
        : ['https://vps.goosebumps.fm']
    })
  : NoopAnalyticsLayer

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

const mainLayer = Layer.mergeAll(analyticsLayer, spotifyLayer, audioStorageLayer, mediaSessionLayer)

type AppServices = Analytics | SpotifyBrowser | AudioStorage | MediaSessionService

const appScope = Scope.makeUnsafe()
const appContextPromise = Effect.runPromise(Layer.buildWithScope(mainLayer, appScope))

export const runAppEffect = <A, E>(effect: Effect.Effect<A, E, AppServices>) =>
  appContextPromise
    .then((context) => Effect.runPromiseWith(context)(effect))
    .catch((error) => {
      console.error('App effect failed', error)
      throw error
    })

export const RuntimeClient = {
  runPromise: runAppEffect
}
