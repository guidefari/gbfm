import { useAtomMount, useAtomSet, useAtomValue } from '@effect/atom-react'
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
  type SpotifyRequestError,
} from '@gbfm/spotify'
import { Data, Effect } from 'effect'
import * as Atom from 'effect/unstable/reactivity/Atom'
import * as WebBrowser from 'expo-web-browser'
import { type PropsWithChildren, useCallback, useMemo } from 'react'

import { env } from '@/env'

import { SPOTIFY_REDIRECT_URI } from './constants'
import { runSpotifyEffect } from './runtime'

export type SpotifyConnectionState = Data.TaggedEnum<{
  Bootstrapping: Record<never, never>
  Disconnected: { readonly error?: string }
  Connecting: Record<never, never>
  Connected: {
    readonly session: SpotifyAuthSession
    readonly profile?: SpotifyProfile
    readonly error?: string
  }
}>

export const SpotifyConnectionState = Data.taggedEnum<SpotifyConnectionState>()

export const spotifyConnectionState = Atom.make<SpotifyConnectionState>(
  SpotifyConnectionState.Bootstrapping(),
).pipe(Atom.keepAlive)

type SetConnectionState = (
  update: (state: SpotifyConnectionState) => SpotifyConnectionState,
) => void

const loadProfile = (setState: SetConnectionState) =>
  runSpotifyEffect(
    fetchSpotifyProfileEffect().pipe(
      Effect.map((profile) =>
        setState((state) =>
          SpotifyConnectionState.$is('Connected')(state)
            ? SpotifyConnectionState.Connected({ session: state.session, profile })
            : state,
        ),
      ),
      Effect.catch((error: SpotifyRequestError) =>
        Effect.sync(() =>
          setState((state) =>
            SpotifyConnectionState.$is('Connected')(state)
              ? SpotifyConnectionState.Connected({ ...state, error: spotifyErrorMessage(error) })
              : state,
          ),
        ),
      ),
    ),
  )

const readStoredSession = async (setState: SetConnectionState) => {
  const stored = await runSpotifyEffect(
    getValidSpotifyAuthSessionEffect().pipe(
      Effect.catch((error: SpotifyRequestError) =>
        Effect.sync(() => {
          setState(() => SpotifyConnectionState.Disconnected({ error: spotifyErrorMessage(error) }))

          return undefined
        }),
      ),
    ),
  )

  setState(() =>
    stored
      ? SpotifyConnectionState.Connected({ session: stored })
      : SpotifyConnectionState.Disconnected({}),
  )

  if (stored) await loadProfile(setState)

  return stored
}

const makeBootstrapAtom = (setState: SetConnectionState) =>
  Atom.make(
    Effect.promise(() =>
      readStoredSession(setState).finally(() =>
        setState((state) =>
          SpotifyConnectionState.$is('Bootstrapping')(state)
            ? SpotifyConnectionState.Disconnected({})
            : state,
        ),
      ),
    ),
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
      setState(() =>
        SpotifyConnectionState.Disconnected({ error: 'Missing EXPO_PUBLIC_SPOTIFY_CLIENT_ID.' }),
      )

      return
    }

    setState(() => SpotifyConnectionState.Connecting())

    try {
      const authUrl = await runSpotifyEffect(
        startSpotifyPkceLoginEffect(SPOTIFY_WEB_SCOPES, SPOTIFY_REDIRECT_URI),
      )

      if (!authUrl) return

      const result = await WebBrowser.openAuthSessionAsync(authUrl, SPOTIFY_REDIRECT_URI)

      if (result.type !== 'success') return

      const callback = readAuthorizationCallback(new URL(result.url))

      if (callback.error) {
        setState(() =>
          SpotifyConnectionState.Disconnected({
            error: callback.error ?? 'Spotify login failed.',
          }),
        )

        return
      }

      if (!callback.code) return

      await runSpotifyEffect(exchangeAndPersist(callback.code, setState))
    } finally {
      setState((state) =>
        SpotifyConnectionState.$is('Connecting')(state)
          ? SpotifyConnectionState.Disconnected({})
          : state,
      )
    }
  }, [setState])
}

const exchangeAndPersist = (code: string, setState: SetConnectionState) =>
  Effect.gen(function* () {
    const session = yield* exchangeSpotifyPkceCodeEffect(code)
    setState(() => SpotifyConnectionState.Connected({ session }))
    yield* fetchSpotifyProfileEffect().pipe(
      Effect.map((profile) =>
        setState((state) =>
          SpotifyConnectionState.$is('Connected')(state)
            ? SpotifyConnectionState.Connected({ session: state.session, profile })
            : state,
        ),
      ),
      Effect.catch((error: SpotifyRequestError) =>
        Effect.sync(() =>
          setState((state) =>
            SpotifyConnectionState.$is('Connected')(state)
              ? SpotifyConnectionState.Connected({ ...state, error: spotifyErrorMessage(error) })
              : state,
          ),
        ),
      ),
    )
  }).pipe(
    Effect.catch((error: SpotifyRequestError) =>
      Effect.sync(() =>
        setState(() => SpotifyConnectionState.Disconnected({ error: spotifyErrorMessage(error) })),
      ),
    ),
  )

export const useDisconnectSpotify = () => {
  const setState = useSetSpotifyConnectionState()

  return useCallback(() => {
    void runSpotifyEffect(logoutSpotifyEffect())
    setState(() => SpotifyConnectionState.Disconnected({}))
  }, [setState])
}
