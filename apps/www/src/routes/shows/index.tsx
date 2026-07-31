import { ShowsSkeleton } from '@gbfm/ui'
import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useMemo } from 'react'
import { z } from 'zod'
import { LoadMoreTrigger } from '@/components/LoadMoreTrigger'
import { EpisodeGrid } from '@/components/shows/EpisodeGrid'
import { SelectedShowBar } from '@/components/shows/SelectedShowBar'
import { ShowListItem } from '@/components/shows/ShowListItem'
import { ShowsPageLayout } from '@/components/shows/ShowsPageLayout'
import { ShowSwitcherRail } from '@/components/shows/ShowSwitcherRail'
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
    return (
      <ShowsPageLayout>
        <ShowsSkeleton />
      </ShowsPageLayout>
    )
  }

  if (error) {
    return (
      <ShowsPageLayout>
        <div className='p-4 text-center text-destructive'>Error loading shows: {error.message}</div>
      </ShowsPageLayout>
    )
  }

  if (!data || data.length === 0) {
    return (
      <ShowsPageLayout>
        <div className='p-4 text-center text-muted-foreground'>No shows found</div>
      </ShowsPageLayout>
    )
  }

  return (
    <ShowsPageLayout>
      <div className='grid grid-cols-1 gap-6 lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-8 lg:items-start'>
        <aside className='hidden lg:block'>
          <nav
            aria-label='Shows'
            className='sticky top-4 max-h-[calc(100dvh-8rem)] space-y-1 overflow-y-auto pr-1 no-scrollbar'>
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

        <div className='space-y-4 lg:hidden'>
          <ShowSwitcherRail
            shows={data}
            selectedShowId={selectedShow?.id}
            onSelect={(show) =>
              navigate({
                to: '.',
                search: { show: show.slug }
              })
            }
          />
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
            <div className='py-12 text-center text-muted-foreground'>
              Select a show to browse its mixes
            </div>
          )}
        </main>
      </div>
    </ShowsPageLayout>
  )
}

function SelectedShowPanel({ show }: { show: ShowWithHosts }) {
  return (
    <section className='space-y-6'>
      <SelectedShowBar show={show} />
      <EpisodeGrid showSlug={show.slug} />
    </section>
  )
}
