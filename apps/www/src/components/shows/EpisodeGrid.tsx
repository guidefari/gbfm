import { LoadMoreTrigger } from '@/components/LoadMoreTrigger'
import { MixListItem } from '@/components/MixListItem'
import { MixTimeline, MixTimelineItem } from '@/components/MixTimeline'
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
      <div className='grid gap-2'>
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            // biome-ignore lint/suspicious/noArrayIndexKey: Static skeleton loader - items never reorder
            key={i}
            className='flex gap-3 items-start p-2'>
            <div className='w-14 h-14 rounded-sm bg-muted/50 animate-pulse shrink-0' />
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
      <MixTimeline>
        {episodes.map((episode) => (
          <MixTimelineItem key={episode.id} mix={episode}>
            <MixListItem mix={episode} />
          </MixTimelineItem>
        ))}
        <LoadMoreTrigger
          onLoadMore={fetchNextPage}
          hasNextPage={hasNextPage}
          isFetchingNextPage={isFetchingNextPage}
        />
      </MixTimeline>
    </div>
  )
}
