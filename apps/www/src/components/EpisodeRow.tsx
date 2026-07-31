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
        'flex items-center justify-between gap-4 border border-border bg-card px-4 py-3 transition-colors duration-200 hover:border-foreground/50',
        isActive && 'ring-1 ring-highlight bg-secondary'
      )}>
      <div className='min-w-0 flex-1'>
        <Link
          to='/mixes/$mixId'
          params={{ mixId: mix.slug }}
          className='text-base font-bold leading-tight tracking-tight text-foreground line-clamp-1 transition-colors'>
          {mix.title}
        </Link>
        <div className='mt-1 flex flex-wrap items-center gap-x-2 gap-y-1'>
          <span className='text-[11px] font-mono tracking-widest text-muted-foreground'>
            {dateLabel}
          </span>
          {hasCreators && (
            <p className='text-xs tracking-widest text-highlight/80'>
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
      </div>

      <div className='shrink-0'>
        <PlayToggle
          state={toPlaybackState({ isCurrent: isActive, isPlaying, isBuffering, isLoaded })}
          variant='button'
          label={mix.title.split(' ')[0]}
          onToggle={handlePlay}
        />
      </div>
    </article>
  )
}
