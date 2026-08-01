import { ShowsSkeleton } from '@gbfm/ui'
import { LoadMoreTrigger } from '@/components/LoadMoreTrigger'
import { useAllShows } from '@/lib/http'
import { EpisodeGrid } from './EpisodeGrid'
import { ShowListItem } from './ShowListItem'
import { ShowMetaBlock, type ShowMeta } from './ShowMetaBlock'
import { ShowSwitcherRail } from './ShowSwitcherRail'

interface ShowsBrowserProps {
  selectedShow: ShowMeta | undefined
  onSelectShow: (slug: string) => void
}

export function ShowsBrowser({ selectedShow, onSelectShow }: ShowsBrowserProps) {
  const { data, isPending, error, fetchNextPage, hasNextPage, isFetchingNextPage } = useAllShows({
    limit: 50
  })

  if (isPending && !selectedShow) {
    return <ShowsSkeleton />
  }

  if (error && !selectedShow) {
    return (
      <div className='p-4 text-center text-destructive'>Error loading shows: {error.message}</div>
    )
  }

  if (!isPending && data.length === 0 && !selectedShow) {
    return <div className='p-4 text-center text-muted-foreground'>No shows found</div>
  }

  return (
    <div className='grid grid-cols-1 gap-6 lg:grid-cols-[220px_minmax(0,1fr)_240px] lg:gap-10'>
      <aside className='hidden lg:block'>
        <div className='no-scrollbar sticky top-4 max-h-[calc(100dvh-8rem)] overflow-y-auto'>
          {selectedShow && (
            <>
              <h2 className='mb-2 border-b border-border/60 pb-2 text-xs font-semibold tracking-wider text-muted-foreground'>
                Show
              </h2>
              <ShowMetaBlock show={selectedShow} />
            </>
          )}
        </div>
      </aside>

      <div className='space-y-4 lg:hidden'>
        <ShowSwitcherRail
          shows={data}
          selectedShowId={selectedShow?.id}
          onSelect={(show) => onSelectShow(show.slug)}
        />
        {selectedShow && <ShowMetaBlock show={selectedShow} />}
        <LoadMoreTrigger
          onLoadMore={fetchNextPage}
          hasNextPage={hasNextPage}
          isFetchingNextPage={isFetchingNextPage}
        />
      </div>

      <main className='min-w-0'>
        {selectedShow && (
          <h1 className='mb-3 border-b border-border/60 pb-2 text-xs font-semibold tracking-wider text-muted-foreground'>
            Episodes
          </h1>
        )}
        {selectedShow ? (
          <EpisodeGrid showSlug={selectedShow.slug} />
        ) : (
          <div className='py-12 text-center text-muted-foreground'>
            Select a show to browse its mixes
          </div>
        )}
      </main>

      <aside className='hidden lg:block'>
        <div className='no-scrollbar sticky top-4 max-h-[calc(100dvh-8rem)] overflow-y-auto pl-1'>
          <h2 className='mb-2 border-b border-border/60 pb-2 text-xs font-semibold tracking-wider text-muted-foreground'>
            All shows
          </h2>
          <nav aria-label='Shows' className='font-mono text-sm'>
            {data.map((show) => (
              <ShowListItem
                key={show.id}
                show={show}
                isSelected={selectedShow?.id === show.id}
                onSelect={() => onSelectShow(show.slug)}
              />
            ))}
            <LoadMoreTrigger
              onLoadMore={fetchNextPage}
              hasNextPage={hasNextPage}
              isFetchingNextPage={isFetchingNextPage}
            />
          </nav>
        </div>
      </aside>
    </div>
  )
}
