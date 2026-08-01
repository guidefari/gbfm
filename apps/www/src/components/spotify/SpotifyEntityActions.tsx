import { toast } from '@gbfm/ui'
import * as Effect from 'effect/Effect'
import { ListPlus } from 'lucide-react'
import { SPOTIFY_GREEN, SpotifyIcon } from '@/components/icons/BrandIcons'
import { useState } from 'react'
import {
  hasActiveSpotifyDeviceEffect,
  playSpotifyEntityEffect,
  queueSpotifyEntityEffect,
  SPOTIFY_ENTITY_KIND,
  type SpotifyEntityRef,
  type SpotifyRequestError,
  spotifyErrorMessage,
  spotifyEntityFromUrl
} from '@/lib/spotify-pkce'
import { runAppEffect } from '@/runtime'
import { useSpotifyConnection } from './SpotifyConnectionProvider'

type Props = {
  url: string
}

const entityNoun: Record<SpotifyEntityRef['kind'], string> = {
  [SPOTIFY_ENTITY_KIND.TRACK]: 'Track',
  [SPOTIFY_ENTITY_KIND.ALBUM]: 'Album',
  [SPOTIFY_ENTITY_KIND.PLAYLIST]: 'Playlist'
}

const actionClass =
  'inline-flex h-full items-center gap-1.5 border-r border-border px-2.5 text-xs font-medium text-muted-foreground transition-colors last:border-r-0 hover:bg-muted hover:text-foreground disabled:opacity-50'

export function SpotifyEntityActions({ url }: Props) {
  const { isConnected } = useSpotifyConnection()
  const [pending, setPending] = useState<'play' | 'queue' | null>(null)

  const entity = spotifyEntityFromUrl(url)
  if (!entity || !isConnected) return null

  const openInSpotify = () => {
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  const run = async (action: 'play' | 'queue') => {
    setPending(action)

    await runAppEffect(
      hasActiveSpotifyDeviceEffect().pipe(
        Effect.flatMap((hasDevice) => {
          if (!hasDevice) {
            return Effect.sync(() => {
              toast({
                title: 'No active Spotify device',
                description: 'Opening in Spotify instead.'
              })
              openInSpotify()
            })
          }

          if (action === 'play') {
            return playSpotifyEntityEffect(entity).pipe(
              Effect.map(() => {
                toast({ title: `Playing ${entityNoun[entity.kind].toLowerCase()}` })
              })
            )
          }

          return queueSpotifyEntityEffect(entity).pipe(
            Effect.map((count) => {
              toast({
                title: count === 1 ? 'Added to queue' : `Added ${count} tracks to queue`
              })
            })
          )
        }),
        Effect.catch((e: SpotifyRequestError) =>
          Effect.sync(() => {
            toast({ title: 'Spotify', description: spotifyErrorMessage(e) })
            openInSpotify()
          })
        )
      )
    ).finally(() => setPending(null))
  }

  return (
    <div className='inline-flex h-7 items-center overflow-hidden rounded-sm border border-border'>
      <button
        type='button'
        className={`${actionClass} bg-[#1db954]/10 text-foreground hover:bg-[#1db954]/20`}
        aria-label={`Play ${entityNoun[entity.kind].toLowerCase()} on Spotify`}
        disabled={pending !== null}
        onClick={(e) => {
          e.stopPropagation()
          void run('play')
        }}>
        {/* Spotify requires their mark alongside any playback control or metadata they supply. */}
        <SpotifyIcon className='h-3.5 w-3.5' style={{ color: SPOTIFY_GREEN }} />
        {pending === 'play' ? 'Playing…' : 'Play'}
      </button>
      <button
        type='button'
        className={actionClass}
        aria-label={`Add ${entityNoun[entity.kind].toLowerCase()} to Spotify queue`}
        disabled={pending !== null}
        onClick={(e) => {
          e.stopPropagation()
          void run('queue')
        }}>
        <ListPlus className='h-3.5 w-3.5' />
        {pending === 'queue' ? 'Queueing…' : 'Queue'}
      </button>
    </div>
  )
}
