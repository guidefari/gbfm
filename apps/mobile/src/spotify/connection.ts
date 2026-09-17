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

export type SpotifyConnectionState =
  | { readonly status: 'bootstrapping' }
  | { readonly status: 'disconnected'; readonly error?: string }
  | { readonly status: 'connecting' }
  | {
      readonly status: 'connected'
      readonly session: SpotifyAuthSession
      readonly profile?: SpotifyProfile
      readonly error?: string
    }

const bootstrappingConnection: SpotifyConnectionState = { status: 'bootstrapping' }

export const spotifyConnectionState = Atom.make<SpotifyConnectionState>(
  bootstrappingConnection
).pipe(Atom.keepAlive)

type SetConnectionState = (
  update: (state: SpotifyConnectionState) => SpotifyConnectionState
) => void

const loadProfile = (setState: SetConnectionState) =>
  runSpotifyEffect(
    fetchSpotifyProfileEffect().pipe(
      Effect.map((profile) =>
        setState((state) =>
          state.status === 'connected' ? { ...state, profile, error: undefined } : state
        )
      ),
      Effect.catch((error: SpotifyRequestError) =>
        Effect.sync(() =>
          setState((state) =>
            state.status === 'connected' ? { ...state, error: spotifyErrorMessage(error) } : state
          )
        )
      )
    )
  )

const readStoredSession = async (setState: SetConnectionState) => {
  const stored = await runSpotifyEffect(
    getValidSpotifyAuthSessionEffect().pipe(
      Effect.catch((error: SpotifyRequestError) =>
        Effect.sync(() => {
          setState(() => ({ status: 'disconnected', error: spotifyErrorMessage(error) }))
          return undefined
        })
      )
    )
  )

  setState(() => (stored ? { status: 'connected', session: stored } : { status: 'disconnected' }))
  if (stored) await loadProfile(setState)
  return stored
}

const makeBootstrapAtom = (setState: SetConnectionState) =>
  Atom.make(
    Effect.promise(() =>
      readStoredSession(setState).finally(() =>
        setState((state) => (state.status === 'bootstrapping' ? { status: 'disconnected' } : state))
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
      setState(() => ({ status: 'disconnected', error: 'Missing EXPO_PUBLIC_SPOTIFY_CLIENT_ID.' }))
      return
    }

    setState(() => ({ status: 'connecting' }))

    try {
      const authUrl = await runSpotifyEffect(
        startSpotifyPkceLoginEffect(SPOTIFY_WEB_SCOPES, SPOTIFY_REDIRECT_URI)
      )
      if (!authUrl) return

      const result = await WebBrowser.openAuthSessionAsync(authUrl, SPOTIFY_REDIRECT_URI)
      if (result.type !== 'success') return

      const callback = readAuthorizationCallback(new URL(result.url))
      if (callback.error) {
        setState(() => ({
          status: 'disconnected',
          error: callback.error ?? 'Spotify login failed.'
        }))
        return
      }
      if (!callback.code) return

      await runSpotifyEffect(exchangeAndPersist(callback.code, setState))
    } finally {
      setState((state) => (state.status === 'connecting' ? { status: 'disconnected' } : state))
    }
  }, [setState])
}

const exchangeAndPersist = (code: string, setState: SetConnectionState) =>
  Effect.gen(function* () {
    const session = yield* exchangeSpotifyPkceCodeEffect(code)
    setState(() => ({ status: 'connected', session }))
    yield* fetchSpotifyProfileEffect().pipe(
      Effect.map((profile) =>
        setState((state) =>
          state.status === 'connected' ? { ...state, profile, error: undefined } : state
        )
      ),
      Effect.catch((error: SpotifyRequestError) =>
        Effect.sync(() =>
          setState((state) =>
            state.status === 'connected' ? { ...state, error: spotifyErrorMessage(error) } : state
          )
        )
      )
    )
  }).pipe(
    Effect.catch((error: SpotifyRequestError) =>
      Effect.sync(() =>
        setState(() => ({ status: 'disconnected', error: spotifyErrorMessage(error) }))
      )
    )
  )

export const useDisconnectSpotify = () => {
  const setState = useSetSpotifyConnectionState()
  return useCallback(() => {
    void runSpotifyEffect(logoutSpotifyEffect())
    setState(() => ({ status: 'disconnected' }))
  }, [setState])
}
