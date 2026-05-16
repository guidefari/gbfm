import { ShowsSkeleton } from '@gbfm/ui'
import { createFileRoute } from '@tanstack/react-router'
import { ShowCard } from '@/components/shows/ShowCard'
import { useAllShows } from '@/lib/http'
import { generateSEOMeta, STATIC_PAGE_SEO } from '@/lib/seo'

export const Route = createFileRoute('/shows/')({
  component: ShowsListPage,
  head: () => ({
    meta: generateSEOMeta(STATIC_PAGE_SEO.shows)
  })
})

function ShowsListPage() {
  const {
    data,
    isPending,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage
  } = useAllShows()

  if (isPending) {
    return <ShowsSkeleton />
  }

  if (error) {
    return (
      <div className='p-4 text-center text-destructive'>
        Error loading shows: {error.message}
      </div>
    )
  }

  if (!data || data.length === 0) {
    return (
      <div className='p-4 text-center text-muted-foreground'>
        No shows found
      </div>
    )
  }

  return (
    <div className='p-4 mx-auto max-w-7xl'>
      <h1 className='mb-6 text-3xl font-bold text-foreground'>Radio Shows</h1>
      <div className='grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6'>
        {data.map((show) => (
          <ShowCard key={show.id} show={show} />
        ))}
      </div>

      {hasNextPage && (
        <div className='flex justify-center mt-8'>
          <button
            type='button'
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
            className='px-6 py-3 text-sm font-medium transition-colors rounded-sm bg-muted hover:bg-muted/80 disabled:opacity-50 disabled:cursor-not-allowed'>
            {isFetchingNextPage ? 'Loading...' : 'Load More Shows'}
          </button>
        </div>
      )}
    </div>
  )
}
