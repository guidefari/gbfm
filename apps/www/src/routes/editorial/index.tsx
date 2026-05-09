import { createFileRoute } from '@tanstack/react-router'
import { Tag, X } from 'lucide-react'
import { useMemo } from 'react'
import { z } from 'zod'
import { EditorialListItem } from '@/components/EditorialListItem'
import { LoadMoreTrigger } from '@/components/LoadMoreTrigger'
import { PostsNav } from '@/components/PostsNav'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { usePosts } from '@/lib/http'
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
  const { data, isPending, fetchNextPage, hasNextPage, isFetchingNextPage } =
    usePosts('post')

  const allTags = useMemo(() => {
    if (!data) return []
    const tagSet = new Set<string>()
    data.forEach((post) => {
      post.tags?.forEach((t) => {
        tagSet.add(t)
      })
    })
    return Array.from(tagSet).sort()
  }, [data])

  const filteredData = useMemo(() => {
    if (!tag || !data) return data
    return data.filter((post) => post.tags?.includes(tag))
  }, [data, tag])

  const handleTagChange = (newTag: string) => {
    navigate({
      search: newTag === 'all' ? {} : { tag: newTag }
    })
  }

  if (isPending) {
    return (
      <div className='max-w-2xl mx-auto px-4 py-8'>
        <div className='animate-pulse space-y-4'>
          {Array.from({ length: 5 }).map((_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: static array.
            <div key={i} className='h-24 bg-muted/50 rounded-sm' />
          ))}
        </div>
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
        {filteredData?.map((post) => (
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
