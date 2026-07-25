import { SpotifyBrowser } from '@spotify-effect/browser'
import { SpotifyConfigurationError } from '@spotify-effect/core'
import { Context, Effect, Layer, Scope } from 'effect'
import { env } from '@/env'
import { SPOTIFY_REDIRECT_URI } from './constants'
import { installSpotifyCryptoPolyfill } from './cryptoPolyfill'
import {
  hydrateSpotifyTokensFromSecureStore,
  spotifyHistoryStub,
  spotifyLocalStorage,
  spotifySessionStorage
} from './storage'
import { installSpotifyWindowShim } from './windowShim'

const buildSpotifyContext = () => {
  installSpotifyCryptoPolyfill()
  installSpotifyWindowShim()

  const clientId = env.EXPO_PUBLIC_SPOTIFY_CLIENT_ID
  if (!clientId) {
    return Promise.reject(
      new SpotifyConfigurationError({ message: 'Missing EXPO_PUBLIC_SPOTIFY_CLIENT_ID.' })
    )
  }

  const spotifyLayer = SpotifyBrowser.layer({
    clientId,
    redirectUri: SPOTIFY_REDIRECT_URI,
    session: {
      sessionStorage: spotifySessionStorage,
      localStorage: spotifyLocalStorage,
      history: spotifyHistoryStub
    }
  })

  const scope = Scope.makeUnsafe()
  return hydrateSpotifyTokensFromSecureStore().then(() =>
    Effect.runPromise(Layer.buildWithScope(spotifyLayer, scope))
  )
}

let contextPromise: Promise<Context.Context<SpotifyBrowser>> | null = null

const getSpotifyContext = () => {
  if (!contextPromise) {
    contextPromise = buildSpotifyContext().catch((error: unknown) => {
      contextPromise = null
      throw error
    })
  }
  return contextPromise
}

export const runSpotifyEffect = <A, E>(effect: Effect.Effect<A, E, SpotifyBrowser>) =>
  getSpotifyContext().then((context) => Effect.runPromiseWith(context)(effect))
