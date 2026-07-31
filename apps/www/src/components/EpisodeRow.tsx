import { PlayToggle } from '@gbfm/ui'
import type { SelectAudio } from '@gbfm/vps/schemas'
import { Link } from '@tanstack/react-router'
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
        'group/item flex items-center gap-3 border-b border-border/40 px-2 py-3 transition-colors duration-200 hover:bg-muted/30',
        isActive && 'bg-secondary'
      )}>
      <PlayToggle
        state={toPlaybackState({ isCurrent: isActive, isPlaying, isBuffering, isLoaded })}
        variant='icon'
        label={mix.title}
        onToggle={handlePlay}
        className='shrink-0'
      />

      <div className='min-w-0 flex-1'>
        <div className='flex min-w-0 items-baseline gap-2.5'>
          <Link
            to='/mixes/$mixId'
            params={{ mixId: mix.slug }}
            className='truncate text-base font-bold leading-tight tracking-tight text-foreground transition-colors group-hover/item:text-highlight'>
            {mix.title}
          </Link>
          <span className='ml-auto shrink-0 font-mono text-[11px] tracking-widest text-muted-foreground'>
            {dateLabel}
          </span>
        </div>
        {hasCreators && (
          <p className='mt-0.5 text-xs tracking-widest text-highlight/80'>
            <span className='opacity-60'>By </span>
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
          </p>
        )}
      </div>
    </article>
  )
}
