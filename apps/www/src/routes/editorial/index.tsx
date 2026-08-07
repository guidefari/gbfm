import { createFileRoute } from '@tanstack/react-router'
import { X } from 'lucide-react'
import { z } from 'zod'
import { EditorialListItem } from '@/components/EditorialListItem'
import { LoadMoreTrigger } from '@/components/LoadMoreTrigger'
import { QueryError } from '@/components/QueryError'
import { useEditorialPosts } from '@/lib/http'
import { generateSEOMeta, STATIC_PAGE_SEO } from '@/lib/seo'

const searchSchema = z.object({
  tag: z.string().optional()
})

export const Route = createFileRoute('/editorial/')({
  component: EditorialListPage,
  validateSearch: searchSchema,
  head: () => ({
    meta: generateSEOMeta(STATIC_PAGE_SEO.editorial)
  })
})

function EditorialListPage() {
  const { tag } = Route.useSearch()
  const navigate = Route.useNavigate()
  const { data, error, isPending, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useEditorialPosts(tag)

  if (isPending) {
    return (
      <div className='max-w-2xl mx-auto px-4 py-8'>
        <div className='animate-pulse space-y-3'>
          {Array.from({ length: 5 }, (_, i) => `skeleton-${i}`).map((key) => (
            <div
              key={key}
              className='flex gap-3 items-start border border-border bg-card p-3 sm:p-4'>
              <div className='h-16 w-16 sm:h-20 sm:w-20 shrink-0 bg-muted/60' />
              <div className='flex-1 min-w-0 space-y-2'>
                <div className='h-2.5 w-8 rounded bg-muted/50' />
                <div className='h-5 w-full rounded bg-muted/60' />
                <div className='h-4 w-4/5 rounded bg-muted/60' />
                <div className='h-3 w-full rounded bg-muted/40' />
                <div className='h-3 w-2/3 rounded bg-muted/40' />
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className='max-w-2xl mx-auto px-4 py-8'>
        <QueryError error={error} onRetry={() => refetch()} />
      </div>
    )
  }

  return (
    <div className='max-w-2xl mx-auto px-4 py-8'>
      {tag && (
        <div className='mb-6 flex items-center gap-2 text-xs tracking-wide text-muted-foreground'>
          <span className='font-semibold text-foreground'>#{tag}</span>
          <button
            type='button'
            onClick={() => navigate({ search: {} })}
            className='hover:text-foreground'
            aria-label='Remove tag filter'>
            <X className='w-3 h-3' />
          </button>
        </div>
      )}
      <div className='grid gap-3'>
        {data?.map((post) => (
          <EditorialListItem key={post.id} post={post} />
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
