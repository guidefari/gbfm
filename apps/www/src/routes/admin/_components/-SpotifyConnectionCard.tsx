import { Button, toast } from '@gbfm/ui'
import * as Data from 'effect/Data'
import * as Effect from 'effect/Effect'
import { useCallback, useEffect, useState } from 'react'
import { env } from '@/env'
import {
  clearAuthorizationCallback,
  exchangeSpotifyPkceCodeEffect,
  fetchSpotifyProfileEffect,
  getSpotifyRedirectUri,
  getValidSpotifyAuthSessionEffect,
  logoutSpotifyEffect,
  readAuthorizationCallback,
  SPOTIFY_WEB_SCOPES,
  type SpotifyAuthSession,
  type SpotifyProfile,
  type SpotifyRequestError,
  spotifyErrorMessage,
  startSpotifyPkceLoginEffect
} from '@/lib/spotify-pkce'
import { runAppEffect } from '@/runtime'

const formatExpiresIn = (expiresAt: number) => {
  const diff = expiresAt - Date.now()
  if (diff <= 0) return 'expired'
  const minutes = Math.floor(diff / 60_000)
  if (minutes < 60) return `~${minutes}m`
  return `~${Math.floor(minutes / 60)}h ${minutes % 60}m`
}

class SpotifyError extends Data.TaggedError('SpotifyError')<{
  message: string
}> {}

const toErrorMessage = (caught: unknown): string => {
  if (caught instanceof Error) return caught.message
  return String(caught)
}

export function SpotifyConnectionCard() {
  const [session, setSession] = useState<SpotifyAuthSession | undefined>()
  const [profile, setProfile] = useState<SpotifyProfile | undefined>()
  const [error, setError] = useState<string | null>(null)
  const [isBootstrapping, setIsBootstrapping] = useState(true)
  const [isConnecting, setIsConnecting] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)

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

  useEffect(() => {
    const bootstrap = async () => {
      try {
        const url = new URL(window.location.href)
        const callback = readAuthorizationCallback(url)

        if (callback.error) {
          clearAuthorizationCallback(url)
          setError(callback.error)
          return
        }

        if (callback.code) {
          const exchanged = await runAppEffect(
            exchangeSpotifyPkceCodeEffect(callback.code).pipe(
              Effect.mapError(
                (e: SpotifyRequestError) =>
                  new SpotifyError({ message: spotifyErrorMessage(e) })
              )
            )
          )
          setSession(exchanged)
          clearAuthorizationCallback(url)
          await loadProfile()
          toast({ title: 'Spotify connected' })
          return
        }

        const stored = await runAppEffect(
          getValidSpotifyAuthSessionEffect().pipe(
            Effect.mapError(
              (e: SpotifyRequestError) =>
                new SpotifyError({ message: spotifyErrorMessage(e) })
            )
          )
        )
        if (stored) {
          setSession(stored)
          await loadProfile()
        }
      } catch (caught) {
        setError(toErrorMessage(caught))
      } finally {
        setIsBootstrapping(false)
      }
    }

    void bootstrap()
  }, [loadProfile])

  const handleConnect = async () => {
    if (!env.spotifyClientId) {
      setError('Missing VITE_SPOTIFY_CLIENT_ID.')
      return
    }
    setError(null)
    setIsConnecting(true)
    await runAppEffect(
      startSpotifyPkceLoginEffect(SPOTIFY_WEB_SCOPES).pipe(
        Effect.map((url) => window.location.assign(url)),
        Effect.catch((e: SpotifyRequestError) =>
          Effect.sync(() => setError(spotifyErrorMessage(e)))
        )
      )
    ).finally(() => setIsConnecting(false))
  }

  const handleRefresh = async () => {
    setError(null)
    setIsRefreshing(true)
    await runAppEffect(
      getValidSpotifyAuthSessionEffect().pipe(
        Effect.flatMap((stored) => {
          if (!stored)
            return Effect.fail(
              new SpotifyError({ message: 'No Spotify session stored.' })
            )
          setSession(stored)
          return Effect.promise(() => loadProfile())
        }),
        Effect.map(() => toast({ title: 'Spotify session refreshed' })),
        Effect.catch((e: SpotifyRequestError | Error) =>
          Effect.sync(() =>
            setError(
              e instanceof Error
                ? e.message
                : spotifyErrorMessage(e as SpotifyRequestError)
            )
          )
        )
      )
    ).finally(() => setIsRefreshing(false))
  }

  const handleLogout = () => {
    void runAppEffect(logoutSpotifyEffect())
    setSession(undefined)
    setProfile(undefined)
    setError(null)
  }

  return (
    <section className='mx-3 mt-3 rounded-md border p-4 space-y-4'>
      <div className='space-y-1'>
        <div className='text-sm font-semibold'>Spotify connection</div>
        <p className='text-xs text-muted-foreground'>
          Sign in with PKCE so this browser can control Spotify playback and use
          the web API.
        </p>
        <p className='text-xs text-muted-foreground'>
          Redirect URI: <code>{getSpotifyRedirectUri()}</code>
        </p>
      </div>

      {isBootstrapping ? (
        <div className='text-sm text-muted-foreground'>Checking session…</div>
      ) : session ? (
        <div className='space-y-3'>
          <div className='flex items-center justify-between gap-3 rounded-md border px-3 py-2'>
            <div className='min-w-0'>
              <div className='text-sm font-medium truncate'>
                {profile?.display_name ?? profile?.id ?? 'Connected'}
              </div>
              <div className='text-xs text-muted-foreground'>
                Token expires {formatExpiresIn(session.accessTokenExpiresAt)}
              </div>
            </div>
            <div className='text-xs font-medium text-green-500'>Connected</div>
          </div>

          <div className='flex flex-wrap gap-2'>
            <Button
              type='button'
              variant='outline'
              size='sm'
              onClick={handleRefresh}
              disabled={isRefreshing}>
              {isRefreshing ? 'Refreshing…' : 'Refresh session'}
            </Button>
            <Button
              type='button'
              variant='ghost'
              size='sm'
              onClick={handleLogout}>
              Logout
            </Button>
          </div>
        </div>
      ) : (
        <Button
          type='button'
          size='sm'
          className='w-full'
          onClick={handleConnect}
          disabled={isConnecting || !env.spotifyClientId}>
          {isConnecting ? 'Connecting…' : 'Connect Spotify'}
        </Button>
      )}

      {error ? <div className='text-xs text-destructive'>{error}</div> : null}
    </section>
  )
}
