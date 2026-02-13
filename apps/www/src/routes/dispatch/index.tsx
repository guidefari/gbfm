import { createFileRoute, Link } from '@tanstack/react-router'
import { Tag, X } from 'lucide-react'
import { useMemo } from 'react'
import { z } from 'zod'
import { LoadMoreTrigger } from '@/components/LoadMoreTrigger'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { DEFAULT_IMAGE_URL } from '@/lib/constants'
import { usePosts } from '@/lib/http'
import { generateSEOMeta, STATIC_PAGE_SEO } from '@/lib/seo'

const searchSchema = z.object({
  tag: z.string().optional()
})

export const Route = createFileRoute('/dispatch/')({
  component: DispatchListPage,
  validateSearch: searchSchema,
  head: () => ({
    meta: generateSEOMeta(STATIC_PAGE_SEO.dispatch)
  })
})

function DispatchListPage() {
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
      <div className='max-w-3xl mx-auto px-4 py-8'>
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
    <div className='max-w-3xl mx-auto px-4 py-8'>
      <div className='flex flex-row items-baseline justify-between gap-4 mb-8 border-b pb-4 border-border/40'>
        <div className='flex items-baseline gap-6'>
          <h1 className='text-2xl font-black tracking-tight'>Dispatch</h1>
          <Link
            to='/pings'
            className='flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors relative group'>
            Pings
            <span className='absolute -bottom-[17px] left-0 right-0 h-0.5 bg-foreground scale-x-0 group-hover:scale-x-100 transition-transform origin-left' />
          </Link>
        </div>
        {allTags.length > 0 && (
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
        )}
      </div>
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
      <div className='grid gap-2'>
        {filteredData?.map((post) => (
          <article
            key={post.id}
            className='flex gap-3 items-start p-2 transition-all duration-300 cursor-pointer hover:bg-muted/50 rounded-sm group'>
            {post.thumbnailUrl && (
              <img
                src={post.thumbnailUrl || DEFAULT_IMAGE_URL}
                alt={post.title}
                className='object-cover transition-transform duration-300 border rounded-sm w-16 h-16 sm:w-20 sm:h-20 border-border bg-background group-hover:scale-105 flex-shrink-0'
              />
            )}
            <div className='flex-1 min-w-0'>
              <Link
                to='/dispatch/$slug'
                params={{ slug: post.slug }}
                className='block font-bold leading-tight line-clamp-2 text-foreground hover:underline decoration-foreground/30 underline-offset-4'>
                {post.title}
              </Link>
              {post.description && (
                <div className='mt-1 text-sm leading-relaxed text-foreground/60 line-clamp-2'>
                  {post.description}
                </div>
              )}
              {post.createdAt && (
                <div className='mt-1 font-mono text-xs text-muted-foreground/60'>
                  {new Date(post.createdAt).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric'
                  })}
                </div>
              )}
            </div>
          </article>
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
