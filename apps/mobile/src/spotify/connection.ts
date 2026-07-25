import {
  exchangeSpotifyPkceCodeEffect,
  fetchSpotifyProfileEffect,
  getValidSpotifyAuthSessionEffect,
  logoutSpotifyEffect,
  readAuthorizationCallback,
  SPOTIFY_WEB_SCOPES,
  spotifyErrorMessage,
  startSpotifyPkceLoginEffect,
  type SpotifyAuthSession,
  type SpotifyProfile,
  type SpotifyRequestError
} from '@gbfm/spotify'
import { useAtomMount, useAtomSet, useAtomValue } from '@effect/atom-react'
import * as Atom from 'effect/unstable/reactivity/Atom'
import { Effect } from 'effect'
import * as WebBrowser from 'expo-web-browser'
import { type PropsWithChildren, useCallback, useMemo } from 'react'
import { env } from '@/env'
import { SPOTIFY_REDIRECT_URI } from './constants'
import { runSpotifyEffect } from './runtime'

export type SpotifyConnectionState = {
  readonly session: SpotifyAuthSession | undefined
  readonly profile: SpotifyProfile | undefined
  readonly isBootstrapping: boolean
  readonly isConnecting: boolean
  readonly error: string | null
}

const emptyConnectionState: SpotifyConnectionState = {
  session: undefined,
  profile: undefined,
  isBootstrapping: true,
  isConnecting: false,
  error: null
}

export const spotifyConnectionState = Atom.make<SpotifyConnectionState>(emptyConnectionState).pipe(
  Atom.keepAlive
)

type SetConnectionState = (
  update: (state: SpotifyConnectionState) => SpotifyConnectionState
) => void

const loadProfile = (setState: SetConnectionState) =>
  runSpotifyEffect(
    fetchSpotifyProfileEffect().pipe(
      Effect.map((profile) => setState((state) => ({ ...state, profile }))),
      Effect.catch((error: SpotifyRequestError) =>
        Effect.sync(() => setState((state) => ({ ...state, error: spotifyErrorMessage(error) })))
      )
    )
  )

const readStoredSession = async (setState: SetConnectionState) => {
  const stored = await runSpotifyEffect(
    getValidSpotifyAuthSessionEffect().pipe(
      Effect.catch((error: SpotifyRequestError) =>
        Effect.sync(() => {
          setState((state) => ({ ...state, error: spotifyErrorMessage(error) }))
          return undefined
        })
      )
    )
  )

  setState((state) => ({ ...state, session: stored }))
  if (stored) await loadProfile(setState)
  return stored
}

const makeBootstrapAtom = (setState: SetConnectionState) =>
  Atom.make(
    Effect.promise(() =>
      readStoredSession(setState).finally(() =>
        setState((state) => ({ ...state, isBootstrapping: false }))
      )
    )
  )

export const useSpotifyConnection = <T>(selector: (state: SpotifyConnectionState) => T) =>
  useAtomValue(spotifyConnectionState, selector)

const useSetSpotifyConnectionState = (): SetConnectionState => useAtomSet(spotifyConnectionState)

export const SpotifyConnectionProvider = ({ children }: PropsWithChildren) => {
  const setState = useSetSpotifyConnectionState()
  const bootstrapAtom = useMemo(() => makeBootstrapAtom(setState), [setState])
  useAtomMount(bootstrapAtom)
  return children
}

export const useConnectSpotify = () => {
  const setState = useSetSpotifyConnectionState()

  return useCallback(async () => {
    if (!env.EXPO_PUBLIC_SPOTIFY_CLIENT_ID) {
      setState((state) => ({ ...state, error: 'Missing EXPO_PUBLIC_SPOTIFY_CLIENT_ID.' }))
      return
    }

    setState((state) => ({ ...state, error: null, isConnecting: true }))

    try {
      const authUrl = await runSpotifyEffect(
        startSpotifyPkceLoginEffect(SPOTIFY_WEB_SCOPES, SPOTIFY_REDIRECT_URI).pipe(
          Effect.catch((error: SpotifyRequestError) =>
            Effect.sync(() => {
              setState((state) => ({ ...state, error: spotifyErrorMessage(error) }))
              return undefined
            })
          )
        )
      )
      if (!authUrl) return

      const result = await WebBrowser.openAuthSessionAsync(authUrl, SPOTIFY_REDIRECT_URI)
      if (result.type !== 'success') return

      const callback = readAuthorizationCallback(new URL(result.url))
      if (callback.error) {
        setState((state) => ({ ...state, error: callback.error ?? 'Spotify login failed.' }))
        return
      }
      if (!callback.code) return

      await runSpotifyEffect(exchangeAndPersist(callback.code, setState))
    } finally {
      setState((state) => ({ ...state, isConnecting: false }))
    }
  }, [setState])
}

const exchangeAndPersist = (code: string, setState: SetConnectionState) =>
  Effect.gen(function* () {
    const session = yield* exchangeSpotifyPkceCodeEffect(code)
    setState((state) => ({ ...state, session }))
    yield* fetchSpotifyProfileEffect().pipe(
      Effect.map((profile) => setState((state) => ({ ...state, profile }))),
      Effect.catch((error: SpotifyRequestError) =>
        Effect.sync(() => setState((state) => ({ ...state, error: spotifyErrorMessage(error) })))
      )
    )
  }).pipe(
    Effect.catch((error: SpotifyRequestError) =>
      Effect.sync(() => setState((state) => ({ ...state, error: spotifyErrorMessage(error) })))
    )
  )

export const useDisconnectSpotify = () => {
  const setState = useSetSpotifyConnectionState()
  return useCallback(() => {
    void runSpotifyEffect(logoutSpotifyEffect())
    setState(() => ({ ...emptyConnectionState, isBootstrapping: false }))
  }, [setState])
}
