import { Link } from '@tanstack/react-router'
import { GiPauseButton, GiPlayButton } from 'react-icons/gi'
import { LoadMoreTrigger } from '@/components/LoadMoreTrigger'
import { DEFAULT_IMAGE_URL } from '@/lib/constants'
import { useShowEpisodes } from '@/lib/http'
import { cn } from '@/lib/utils'
import { useAudioPlayerActions, useAudioPlayerState } from '@/store/audioPlayer'

interface EpisodeGridProps {
  showSlug: string
}

export function EpisodeGrid({ showSlug }: EpisodeGridProps) {
  const {
    data: episodes,
    isPending,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage
  } = useShowEpisodes(showSlug)

  const { isPlaying, nowPlayingContext } = useAudioPlayerState()
  const { loadTrack } = useAudioPlayerActions()

  if (isPending) {
    return (
      <div className='grid gap-2'>
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            // biome-ignore lint/suspicious/noArrayIndexKey: Static skeleton loader - items never reorder
            key={i}
            className='flex gap-3 items-start p-2'>
            <div className='w-14 h-14 rounded-sm bg-muted/50 animate-pulse flex-shrink-0' />
            <div className='flex-1 space-y-2'>
              <div className='h-4 w-3/4 rounded bg-muted/50 animate-pulse' />
              <div className='h-3 w-1/2 rounded bg-muted/50 animate-pulse' />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className='text-center text-destructive py-8'>
        Error loading episodes: {error.message}
      </div>
    )
  }

  if (!episodes || episodes.length === 0) {
    return (
      <div className='text-center text-muted-foreground py-8'>
        No episodes yet
      </div>
    )
  }

  return (
    <div className='space-y-4'>
      <h2 className='text-xl font-bold'>Episodes</h2>
      <div className='grid gap-2'>
        {episodes.map((episode) => {
          const isActive = nowPlayingContext?.title === episode.title

          return (
            <article
              key={episode.id}
              className={cn(
                'flex gap-3 items-start p-2 transition-all duration-300 hover:bg-muted/50 rounded-sm group',
                isActive && 'ring-1 ring-border bg-accent/5 shadow-sm'
              )}>
              <button
                type='button'
                className='relative flex-shrink-0 focus:outline-none'
                onClick={() =>
                  loadTrack(
                    episode.url,
                    episode.thumbnailUrl || DEFAULT_IMAGE_URL,
                    episode.title,
                    episode.id,
                    episode.creators
                  )
                }>
                <img
                  src={episode.thumbnailUrl || DEFAULT_IMAGE_URL}
                  alt={episode.title}
                  className='object-cover transition-transform duration-300 border rounded-sm w-14 h-14 border-border bg-background group-hover:scale-105'
                />
                <span
                  className={cn(
                    'absolute inset-0 flex items-center justify-center transition-all duration-300 rounded-sm bg-black/50',
                    isActive
                      ? 'opacity-100'
                      : 'opacity-0 group-hover:opacity-100 group-focus:opacity-100'
                  )}>
                  {isActive && isPlaying ? (
                    <GiPauseButton className='text-2xl text-white drop-shadow' />
                  ) : (
                    <GiPlayButton className='text-2xl text-white drop-shadow' />
                  )}
                </span>
              </button>
              <div className='flex-1 min-w-0'>
                <Link
                  to='/mixes/$mixId'
                  params={{ mixId: episode.slug }}
                  className='block font-bold leading-none truncate text-foreground hover:underline decoration-foreground/30 underline-offset-4'>
                  {episode.title}
                </Link>
                {episode.description && (
                  <div className='mt-1 text-sm leading-relaxed text-foreground/60 line-clamp-2'>
                    {episode.description}
                  </div>
                )}
              </div>
            </article>
          )
        })}

        <LoadMoreTrigger
          onLoadMore={fetchNextPage}
          hasNextPage={hasNextPage}
          isFetchingNextPage={isFetchingNextPage}
        />
      </div>
    </div>
  )
}
