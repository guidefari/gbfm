import * as Effect from 'effect/Effect'
import {
  createContext,
  type ReactNode,
  use,
  useCallback,
  useEffect,
  useMemo,
  useState
} from 'react'
import { env } from '@/env'
import {
  fetchSpotifyProfileEffect,
  getSpotifyRedirectUri,
  getValidSpotifyAuthSessionEffect,
  logoutSpotifyEffect,
  SPOTIFY_WEB_SCOPES,
  type SpotifyAuthSession,
  type SpotifyProfile,
  type SpotifyRequestError,
  spotifyErrorMessage,
  startSpotifyPkceLoginEffect,
  storeSpotifyReturnPath
} from '@/lib/spotify-pkce'
import { runAppEffect } from '@/runtime'

type SpotifyConnectionValue = {
  session: SpotifyAuthSession | undefined
  profile: SpotifyProfile | undefined
  isConnected: boolean
  isBootstrapping: boolean
  isConnecting: boolean
  error: string | null
  connect: () => Promise<void>
  refresh: () => Promise<void>
  logout: () => void
  clearError: () => void
}

const SpotifyConnectionContext = createContext<SpotifyConnectionValue | null>(null)

export function SpotifyConnectionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<SpotifyAuthSession | undefined>()
  const [profile, setProfile] = useState<SpotifyProfile | undefined>()
  const [error, setError] = useState<string | null>(null)
  const [isBootstrapping, setIsBootstrapping] = useState(true)
  const [isConnecting, setIsConnecting] = useState(false)

  const loadProfile = useCallback(
    () =>
      runAppEffect(
        fetchSpotifyProfileEffect().pipe(
          Effect.map(setProfile),
          Effect.catch((e: SpotifyRequestError) =>
            Effect.sync(() => setError(spotifyErrorMessage(e)))
          )
        )
      ),
    []
  )

  const readStoredSession = useCallback(async () => {
    const stored = await runAppEffect(
      getValidSpotifyAuthSessionEffect().pipe(
        Effect.catch((e: SpotifyRequestError) =>
          Effect.sync(() => {
            setError(spotifyErrorMessage(e))
            return undefined
          })
        )
      )
    )

    setSession(stored)
    if (stored) await loadProfile()
    return stored
  }, [loadProfile])

  useEffect(() => {
    void readStoredSession().finally(() => setIsBootstrapping(false))
  }, [readStoredSession])

  // The callback route stores tokens and navigates back here, so a same-tab
  // return needs a re-read that no React state change would otherwise trigger.
  useEffect(() => {
    const onFocus = () => {
      void readStoredSession()
    }
    window.addEventListener('spotify-session-changed', onFocus)
    return () => window.removeEventListener('spotify-session-changed', onFocus)
  }, [readStoredSession])

  const connect = useCallback(async () => {
    if (!env.spotifyClientId) {
      setError('Missing VITE_SPOTIFY_CLIENT_ID.')
      return
    }

    setError(null)
    setIsConnecting(true)
    storeSpotifyReturnPath(`${window.location.pathname}${window.location.search}`)

    await runAppEffect(
      startSpotifyPkceLoginEffect(SPOTIFY_WEB_SCOPES, getSpotifyRedirectUri()).pipe(
        Effect.map((url) => window.location.assign(url))
      )
    ).finally(() => setIsConnecting(false))
  }, [])

  const refresh = useCallback(async () => {
    setError(null)
    await readStoredSession()
  }, [readStoredSession])

  const logout = useCallback(() => {
    void runAppEffect(logoutSpotifyEffect())
    setSession(undefined)
    setProfile(undefined)
    setError(null)
  }, [])

  const value = useMemo<SpotifyConnectionValue>(
    () => ({
      session,
      profile,
      isConnected: Boolean(session),
      isBootstrapping,
      isConnecting,
      error,
      connect,
      refresh,
      logout,
      clearError: () => setError(null)
    }),
    [session, profile, isBootstrapping, isConnecting, error, connect, refresh, logout]
  )

  return <SpotifyConnectionContext value={value}>{children}</SpotifyConnectionContext>
}

export function useSpotifyConnection() {
  const value = use(SpotifyConnectionContext)
  if (!value) {
    throw new Error('useSpotifyConnection must be used within SpotifyConnectionProvider')
  }
  return value
}
