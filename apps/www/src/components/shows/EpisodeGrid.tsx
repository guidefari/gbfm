import { EpisodeRow } from '@/components/EpisodeRow'
import { LoadMoreTrigger } from '@/components/LoadMoreTrigger'
import { useShowEpisodes } from '@/lib/http'

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
  } = useShowEpisodes(showSlug, { limit: 50 })

  if (isPending) {
    return (
      <div className='space-y-1'>
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            // oxlint-disable-next-line react/no-array-index-key
            key={i}
            className='flex items-center gap-3 px-1 py-1.5'>
            <div className='size-4 shrink-0 rounded bg-muted/50 animate-pulse' />
            <div className='min-w-0 flex-1 space-y-2'>
              <div className='h-4 w-3/4 rounded bg-muted/50 animate-pulse' />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className='text-center text-destructive py-8 font-mono text-sm'>
        Error loading episodes: {error.message}
      </div>
    )
  }

  if (!episodes || episodes.length === 0) {
    return (
      <div className='text-center text-muted-foreground py-8 font-mono text-sm'>
        No episodes yet
      </div>
    )
  }

  return (
    <div className='font-mono'>
      {episodes.map((episode) => (
        <EpisodeRow key={episode.id} mix={episode} />
      ))}
      <LoadMoreTrigger
        onLoadMore={fetchNextPage}
        hasNextPage={hasNextPage}
        isFetchingNextPage={isFetchingNextPage}
      />
    </div>
  )
}
