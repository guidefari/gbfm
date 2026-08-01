import { Button } from '@gbfm/ui'
import { SPOTIFY_GREEN, SpotifyIcon } from '@/components/icons/BrandIcons'
import { env } from '@/env'
import { getSpotifyRedirectUri } from '@/lib/spotify-pkce'
import { useSpotifyConnection } from './SpotifyConnectionProvider'

const formatExpiresIn = (expiresAt: number) => {
  const diff = expiresAt - Date.now()
  if (diff <= 0) return 'expired'
  const minutes = Math.floor(diff / 60_000)
  if (minutes < 60) return `~${minutes}m`
  return `~${Math.floor(minutes / 60)}h ${minutes % 60}m`
}

export function SpotifyConnectionCard() {
  const { session, profile, isBootstrapping, isConnecting, error, connect, refresh, logout } =
    useSpotifyConnection()

  return (
    <div className='space-y-8'>
      <div className='space-y-1'>
        <h3 className='flex items-center gap-2 text-base font-bold tracking-widest text-muted-foreground'>
          <SpotifyIcon aria-hidden className='h-4 w-4' style={{ color: SPOTIFY_GREEN }} />
          Spotify Connection
        </h3>
        <p className='text-xs text-muted-foreground font-medium tracking-wider'>
          Connect Spotify to play and queue tracks straight from music cards.
        </p>
        <p className='text-xs text-muted-foreground/70 font-medium tracking-wider'>
          Redirect URI: <code>{getSpotifyRedirectUri()}</code>
        </p>
      </div>

      {isBootstrapping ? (
        <div className='text-xs font-medium tracking-wider text-muted-foreground'>
          Checking session…
        </div>
      ) : session ? (
        <div className='w-full max-w-md space-y-4'>
          <div className='flex items-center justify-between gap-6 border-2 border-border p-6'>
            <div className='min-w-0 space-y-2'>
              <div className='truncate text-base font-bold tracking-widest text-foreground'>
                {profile?.display_name ?? profile?.id ?? 'Connected'}
              </div>
              <div className='text-xs font-medium tracking-wider text-muted-foreground'>
                Token expires {formatExpiresIn(session.accessTokenExpiresAt)}
              </div>
            </div>
            <span className='text-xs font-bold tracking-widest text-green-500'>Connected</span>
          </div>

          <div className='flex flex-wrap gap-2'>
            <Button type='button' variant='outline' size='sm' onClick={() => void refresh()}>
              Refresh session
            </Button>
            <Button type='button' variant='ghost' size='sm' onClick={logout}>
              Disconnect
            </Button>
          </div>
        </div>
      ) : (
        <Button
          type='button'
          size='sm'
          className='w-full max-w-md'
          onClick={() => void connect()}
          disabled={isConnecting || !env.spotifyClientId}>
          {isConnecting ? 'Connecting…' : 'Connect Spotify'}
        </Button>
      )}

      {error ? (
        <div className='text-xs font-medium tracking-wider text-destructive'>{error}</div>
      ) : null}
    </div>
  )
}
