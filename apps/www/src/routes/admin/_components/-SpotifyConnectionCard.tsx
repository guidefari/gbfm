import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/use-toast'
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

export function SpotifyConnectionCard() {
  const [session, setSession] = useState<SpotifyAuthSession | undefined>()
  const [profile, setProfile] = useState<SpotifyProfile | undefined>()
  const [error, setError] = useState<string | null>(null)
  const [isBootstrapping, setIsBootstrapping] = useState(true)
  const [isConnecting, setIsConnecting] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)

  const loadProfile = useCallback(async () => {
    const data = await runAppEffect(fetchSpotifyProfileEffect())
    setProfile(data)
  }, [])

  useEffect(() => {
    const bootstrap = async () => {
      try {
        const url = new URL(window.location.href)
        const callback = readAuthorizationCallback(url)

        if (callback.error) {
          clearAuthorizationCallback(url)
          throw new Error(callback.error)
        }

        if (callback.code) {
          const exchanged = await runAppEffect(
            exchangeSpotifyPkceCodeEffect({ code: callback.code })
          )
          setSession(exchanged)
          clearAuthorizationCallback(url)
          await loadProfile()
          toast({ title: 'Spotify connected' })
          return
        }

        const stored = await runAppEffect(getValidSpotifyAuthSessionEffect())
        if (stored) {
          setSession(stored)
          await loadProfile()
        }
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : String(caught))
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

    try {
      const url = await runAppEffect(
        startSpotifyPkceLoginEffect({ scopes: SPOTIFY_WEB_SCOPES })
      )
      window.location.assign(url)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught))
      setIsConnecting(false)
    }
  }

  const handleRefresh = async () => {
    setError(null)
    setIsRefreshing(true)

    try {
      const stored = await runAppEffect(getValidSpotifyAuthSessionEffect())
      if (!stored) {
        throw new Error('No Spotify session stored.')
      }

      setSession(stored)
      await loadProfile()
      toast({ title: 'Spotify session refreshed' })
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught))
    } finally {
      setIsRefreshing(false)
    }
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
