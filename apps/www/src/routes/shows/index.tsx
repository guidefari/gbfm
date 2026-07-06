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
    <div className='p-4 mx-auto max-w-7xl'>
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

        <div className='lg:hidden'>
          <nav className='flex gap-3 overflow-x-auto pb-3 no-scrollbar'>
            {data.map((show) => (
              <div key={show.id} className='min-w-[220px] max-w-[220px]'>
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
      <div className='flex flex-col sm:flex-row gap-6 items-start pt-2 mb-8 pb-8 border-b border-border/40'>
        <img
          src={show.thumbnailUrl || DEFAULT_IMAGE_URL}
          alt={show.title}
          className='w-40 h-40 object-cover border rounded-sm border-border bg-background shrink-0'
        />
        <div className='flex-1 min-w-0 space-y-3'>
          <h2 className='text-3xl font-black tracking-tight mt-0'>{show.title}</h2>
          {hostNames && (
            <Link
              to='/shows/$showSlug'
              params={{ showSlug: show.slug }}
              className='text-sm text-muted-foreground hover:text-foreground transition-colors'>
              Hosted by {hostNames}
            </Link>
          )}
          {show.description && (
            <p className='text-sm text-foreground/70 line-clamp-4'>{show.description}</p>
          )}
          <div className='flex flex-wrap items-center gap-3 pt-1'>
            <div className='w-full sm:w-auto'>
              <SubscribeButton showId={show.id} showTitle={show.title} />
            </div>
            <Link
              to='/$slug'
              params={{ slug: show.slug }}
              className='text-sm font-medium text-primary hover:opacity-80'>
              View show page
            </Link>
          </div>
        </div>
      </div>
      <EpisodeGrid showSlug={show.slug} />
    </section>
  )
}
