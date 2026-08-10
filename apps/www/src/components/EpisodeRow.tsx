import { Badge, PlayToggle } from '@gbfm/ui'
import type { SelectAudio } from '@gbfm/server/schemas'
import { Link } from '@tanstack/react-router'
import { useSession } from '@/lib/auth-client'
import { cn } from '@/lib/utils'
import { useNowPlayingTrack, usePlayerActions, useTransport } from '@/services/player'
import { toPlaybackState } from '@/services/player/toPlaybackState'
import { toQueueTrack } from '@/services/player/toQueueTrack'

interface EpisodeRowProps {
  mix: SelectAudio
}

export function EpisodeRow({ mix }: EpisodeRowProps) {
  const current = useNowPlayingTrack()
  const { isPlaying, isBuffering, isLoaded } = useTransport()
  const { playTrack, togglePlayPause } = usePlayerActions()
  const { data: session } = useSession()
  const isAdmin = session?.user?.role === 'admin'

  const isActive = current?.id === mix.id
  const hasCreators = Boolean(mix.creators && mix.creators.length > 0)
  const dateLabel = new Date(mix.createdAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })

  const handlePlay = () => {
    if (isActive) togglePlayPause()
    else playTrack(toQueueTrack(mix))
  }

  return (
    <article
      data-testid='episode-row'
      className={cn(
        'group/item flex max-w-2xl items-center gap-2 border-b border-border/40 px-1 py-1.5 text-base transition-colors duration-150 last:border-b-0',
        isActive && 'text-highlight'
      )}>
      <PlayToggle
        state={toPlaybackState({ isCurrent: isActive, isPlaying, isBuffering, isLoaded })}
        variant='icon'
        label={mix.title}
        onToggle={handlePlay}
        className={cn(
          'shrink-0 transition-opacity',
          !isActive && 'opacity-40 group-hover/item:opacity-100 group-focus-within/item:opacity-100'
        )}
      />

      <Link
        to='/mixes/$mixId'
        params={{ mixId: mix.slug }}
        className={cn(
          'min-w-0 shrink truncate transition-colors group-hover/item:text-highlight',
          isActive ? 'text-highlight' : 'text-foreground'
        )}>
        {mix.title}
      </Link>

      {isAdmin && mix.draft && (
        <Badge variant='secondary' className='shrink-0'>
          Draft
        </Badge>
      )}

      <span className='shrink-0 text-[11px] tracking-widest text-muted-foreground'>
        {dateLabel}
      </span>

      {hasCreators && (
        <span className='hidden min-w-0 truncate text-muted-foreground sm:inline'>
          {mix.creators?.map((creator, index) => (
            <span key={creator.id}>
              {creator.username ? (
                <Link
                  to='/profile/$username'
                  params={{ username: creator.username }}
                  className='hover:underline decoration-highlight/50 underline-offset-4'>
                  {creator.name}
                </Link>
              ) : (
                <span>{creator.name}</span>
              )}
              {index < (mix.creators?.length || 0) - 1 && (
                <span className='mx-1 opacity-50'>&</span>
              )}
            </span>
          ))}
        </span>
      )}
    </article>
  )
}
