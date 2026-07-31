import { PlayToggle } from '@gbfm/ui'
import type { SelectAudio } from '@gbfm/vps/schemas'
import { Link } from '@tanstack/react-router'
import { Artwork } from '@/components/common/Artwork'
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
        'group/item flex items-center gap-3 border border-border bg-card px-3 py-2.5 transition-colors duration-200 hover:border-foreground/50',
        isActive && 'ring-1 ring-highlight bg-secondary'
      )}>
      <Artwork
        src={mix.thumbnailUrl}
        alt={mix.title}
        className='aspect-square w-14 shrink-0 rounded-[2px]'
      />

      <div className='min-w-0 flex-1'>
        <div className='flex min-w-0 items-center gap-2'>
          {mix.episodeNumber !== null && mix.episodeNumber !== undefined && (
            <span className='shrink-0 font-mono text-[11px] tracking-widest text-muted-foreground'>
              {String(mix.episodeNumber).padStart(3, '0')}
            </span>
          )}
          <Link
            to='/mixes/$mixId'
            params={{ mixId: mix.slug }}
            className='truncate text-base font-bold leading-tight tracking-tight text-foreground transition-colors group-hover/item:text-highlight'>
            {mix.title}
          </Link>
        </div>
        <div className='mt-1 flex flex-wrap items-center gap-x-2 gap-y-1'>
          <span className='font-mono text-[11px] tracking-widest text-muted-foreground'>
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

      <PlayToggle
        state={toPlaybackState({ isCurrent: isActive, isPlaying, isBuffering, isLoaded })}
        variant='icon'
        label={mix.title}
        onToggle={handlePlay}
        className='shrink-0 p-1.5'
      />
    </article>
  )
}
