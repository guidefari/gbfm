import { toast } from '@gbfm/ui'
import * as Effect from 'effect/Effect'
import { ListPlus, Play } from 'lucide-react'
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
  'inline-flex items-center gap-1 rounded-sm bg-muted/50 px-2 py-0.5 text-[10px] font-bold tracking-widest text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50'

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
    <>
      <button
        type='button'
        className={actionClass}
        disabled={pending !== null}
        onClick={(e) => {
          e.stopPropagation()
          void run('play')
        }}>
        <Play className='h-2.5 w-2.5' />
        {pending === 'play' ? 'Playing…' : 'Play'}
      </button>
      <button
        type='button'
        className={actionClass}
        disabled={pending !== null}
        onClick={(e) => {
          e.stopPropagation()
          void run('queue')
        }}>
        <ListPlus className='h-2.5 w-2.5' />
        {pending === 'queue' ? 'Queueing…' : 'Queue'}
      </button>
    </>
  )
}
