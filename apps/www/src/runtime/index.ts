import { SpotifyBrowser } from '@spotify-effect/browser'
import { Effect, Layer, Scope } from 'effect'
import { env } from '@/env'
import { getSpotifyRedirectUri } from '@/lib/spotify-pkce'
import {
  type Analytics,
  makeSentryAnalyticsLayer,
  NoopAnalyticsLayer
} from '@/services/analytics'
import {
  AudioStorage,
  AudioStorageLive,
  MediaSessionService,
  MediaSessionServiceLive
} from '@/services/audio-player'

const analyticsLayer = env.sentryDsn
  ? makeSentryAnalyticsLayer({
      dsn: env.sentryDsn,
      environment:
        env.sentryEnvironment ?? (env.isDev ? 'development' : 'production'),
      debug: env.isDev,
      tracesSampleRate: env.isDev ? 1.0 : 0.1
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

const mainLayer = Layer.mergeAll(
  analyticsLayer,
  spotifyLayer,
  audioStorageLayer,
  mediaSessionLayer
)

type AppServices =
  | Analytics
  | SpotifyBrowser
  | AudioStorage
  | MediaSessionService

const appScope = Scope.makeUnsafe()
const appContextPromise = Effect.runPromise(
  Layer.buildWithScope(mainLayer, appScope)
)

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
