import { ShowsSkeleton } from '@gbfm/ui'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useEffect, useMemo } from 'react'
import { z } from 'zod'
import { LoadMoreTrigger } from '@/components/LoadMoreTrigger'
import { EpisodeGrid } from '@/components/shows/EpisodeGrid'
import { ShowListItem } from '@/components/shows/ShowListItem'
import { SubscribeButton } from '@/components/shows/SubscribeButton'
import { DEFAULT_IMAGE_URL } from '@/lib/constants'
import { useAllShows, type ShowWithHosts } from '@/lib/http'
import { generateSEOMeta, STATIC_PAGE_SEO } from '@/lib/seo'

const searchSchema = z.object({
  show: z.string().optional()
})

export const Route = createFileRoute('/shows/')({
  component: ShowsListPage,
  validateSearch: searchSchema,
  head: () => ({
    meta: generateSEOMeta(STATIC_PAGE_SEO.shows)
  })
})

function ShowsListPage() {
  const { show: selectedSlug } = Route.useSearch()
  const navigate = Route.useNavigate()
  const { data, isPending, error, fetchNextPage, hasNextPage, isFetchingNextPage } = useAllShows()

  useEffect(() => {
    if (data.length > 0 && !selectedSlug) {
      navigate({
        to: '.',
        search: { show: data[0].slug },
        replace: true
      })
    }
  }, [data, selectedSlug, navigate])

  const selectedShow = useMemo(
    () => data.find((show) => show.slug === selectedSlug),
    [data, selectedSlug]
  )

  if (isPending) {
    return <ShowsSkeleton />
  }

  if (error) {
    return (
      <div className='p-4 text-center text-destructive'>Error loading shows: {error.message}</div>
    )
  }

  if (!data || data.length === 0) {
    return <div className='p-4 text-center text-muted-foreground'>No shows found</div>
  }

  return (
    <div className='px-4 py-4 mx-auto max-w-7xl sm:py-6'>
      <div className='grid grid-cols-1 gap-6 lg:grid-cols-[280px_1fr] lg:gap-8'>
        <aside className='hidden lg:block'>
          <nav className='sticky top-6 max-h-[calc(100vh-3rem)] overflow-y-auto space-y-2 pr-2 no-scrollbar'>
            {data.map((show) => (
              <ShowListItem
                key={show.id}
                show={show}
                isSelected={selectedShow?.id === show.id}
                onSelect={() =>
                  navigate({
                    to: '.',
                    search: { show: show.slug }
                  })
                }
              />
            ))}
            <LoadMoreTrigger
              onLoadMore={fetchNextPage}
              hasNextPage={hasNextPage}
              isFetchingNextPage={isFetchingNextPage}
            />
          </nav>
        </aside>

        <div className='min-w-0 lg:hidden'>
          <p className='mb-2 text-[11px] font-mono font-bold tracking-widest text-highlight/80'>
            SELECT A SHOW
          </p>
          <nav
            aria-label='Select a show'
            className='flex gap-2 -mx-4 px-4 pb-3 overflow-x-auto overscroll-x-contain snap-x snap-mandatory scroll-px-4 no-scrollbar'>
            {data.map((show) => (
              <div key={show.id} className='w-[172px] shrink-0 snap-start sm:w-[188px]'>
                <ShowListItem
                  show={show}
                  isSelected={selectedShow?.id === show.id}
                  onSelect={() =>
                    navigate({
                      to: '.',
                      search: { show: show.slug }
                    })
                  }
                />
              </div>
            ))}
          </nav>
          <LoadMoreTrigger
            onLoadMore={fetchNextPage}
            hasNextPage={hasNextPage}
            isFetchingNextPage={isFetchingNextPage}
          />
        </div>

        <main className='min-w-0'>
          {selectedShow ? (
            <SelectedShowPanel show={selectedShow} />
          ) : (
            <div className='text-center text-muted-foreground py-12'>
              Select a show to browse its mixes
            </div>
          )}
        </main>
      </div>
    </div>
  )
}

function SelectedShowPanel({ show }: { show: ShowWithHosts }) {
  const hostNames = show.hosts?.map((h) => h.name).join(', ')

  return (
    <section>
      <div className='grid grid-cols-[7rem_minmax(0,1fr)] gap-x-4 gap-y-3 items-start mb-5 pb-5 border-b border-border/40 sm:grid-cols-[10rem_minmax(0,1fr)] sm:gap-x-6 sm:pt-2 sm:mb-8 sm:pb-8'>
        <img
          src={show.thumbnailUrl || DEFAULT_IMAGE_URL}
          alt={`Artwork for ${show.title}`}
          width={160}
          height={160}
          fetchPriority='high'
          sizes='(max-width: 639px) 112px, 160px'
          className='w-28 aspect-square object-cover border rounded-sm border-border bg-background shrink-0 sm:w-40'
        />
        <div className='min-w-0 space-y-2 sm:space-y-3'>
          <h1 className='mt-0 text-xl font-black leading-tight tracking-tight wrap-break-word sm:text-3xl'>
            {show.title}
          </h1>
          {hostNames && (
            <Link
              to='/shows/$showSlug'
              params={{ showSlug: show.slug }}
              className='inline-flex min-h-11 items-center text-xs text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:text-sm'>
              Hosted by {hostNames}
            </Link>
          )}
        </div>
        <div className='col-span-2 min-w-0 sm:col-span-1 sm:col-start-2'>
          {show.description && (
            <p className='mb-3 text-sm leading-relaxed text-foreground/70 line-clamp-3 sm:line-clamp-4'>
              {show.description}
            </p>
          )}
          <div className='flex flex-wrap items-center gap-2 sm:gap-3'>
            <SubscribeButton showId={show.id} showTitle={show.title} />
            <Link
              to='/$slug'
              params={{ slug: show.slug }}
              className='inline-flex min-h-11 items-center px-2 text-sm font-medium text-primary hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'>
              View show page
            </Link>
          </div>
        </div>
      </div>
      <EpisodeGrid showSlug={show.slug} />
    </section>
  )
}
