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
  } = useShowEpisodes(showSlug)

  if (isPending) {
    return (
      <div className='space-y-3'>
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            // oxlint-disable-next-line react/no-array-index-key
            key={i}
            className='flex items-center gap-3 border border-border px-3 py-2.5'>
            <div className='size-8 shrink-0 rounded bg-muted/50 animate-pulse' />
            <div className='min-w-0 flex-1 space-y-2'>
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
    return <div className='text-center text-muted-foreground py-8'>No episodes yet</div>
  }

  return (
    <div className='space-y-4'>
      <h2 className='text-xl font-bold'>Episodes</h2>
      <div className='space-y-3'>
        {episodes.map((episode) => (
          <EpisodeRow key={episode.id} mix={episode} />
        ))}
        <LoadMoreTrigger
          onLoadMore={fetchNextPage}
          hasNextPage={hasNextPage}
          isFetchingNextPage={isFetchingNextPage}
        />
      </div>
    </div>
  )
}
