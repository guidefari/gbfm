import { Badge, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@gbfm/ui'
import { createFileRoute } from '@tanstack/react-router'
import { Tag, X } from 'lucide-react'
import { z } from 'zod'
import { EditorialListItem } from '@/components/EditorialListItem'
import { LoadMoreTrigger } from '@/components/LoadMoreTrigger'
import { PostsNav } from '@/components/PostsNav'
import { QueryError } from '@/components/QueryError'
import { useEditorialPosts, useEditorialTags } from '@/lib/http'
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

  const { data: allTags } = useEditorialTags()

  const handleTagChange = (newTag: string) => {
    navigate({
      search: newTag === 'all' ? {} : { tag: newTag }
    })
  }

  if (isPending) {
    return (
      <div className='max-w-2xl mx-auto px-4 py-8'>
        <PostsNav active='editorial' />
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
        <PostsNav active='editorial' />
        <QueryError error={error} onRetry={() => refetch()} />
      </div>
    )
  }

  return (
    <div className='max-w-2xl mx-auto px-4 py-8'>
      <PostsNav active='editorial' />
      {allTags.length > 0 && (
        <div className='mb-6'>
          <Select value={tag || 'all'} onValueChange={handleTagChange}>
            <SelectTrigger className='w-auto min-w-[120px] h-9 text-xs font-semibold uppercase tracking-wider bg-transparent border-none shadow-none hover:bg-muted/50 transition-colors px-3'>
              <div className='flex items-center gap-2'>
                <Tag className='w-3 h-3' />
                <SelectValue placeholder='Filter' />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='all'>All tags</SelectItem>
              {allTags.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      {tag && (
        <div className='flex items-center gap-2 mb-3'>
          <Badge variant='secondary' className='gap-1'>
            <Tag className='w-3 h-3' />
            {tag}
            <button
              type='button'
              onClick={() => navigate({ search: {} })}
              className='ml-1 hover:text-foreground'
              aria-label='Remove tag filter'>
              <X className='w-3 h-3' />
            </button>
          </Badge>
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
