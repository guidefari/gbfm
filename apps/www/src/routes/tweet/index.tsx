import { createFileRoute, Link } from '@tanstack/react-router'
import { Tag, X } from 'lucide-react'
import { useMemo } from 'react'
import { z } from 'zod'
import { LoadMoreTrigger } from '@/components/LoadMoreTrigger'
import { MDXRendrr } from '@/components/MDXRendrr'
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

export const Route = createFileRoute('/tweet/')({
  component: TweetListPage,
  validateSearch: searchSchema,
  head: () => ({
    meta: generateSEOMeta(STATIC_PAGE_SEO.tweet)
  })
})

function TweetListPage() {
  const { tag } = Route.useSearch()
  const navigate = Route.useNavigate()
  const { data, isPending, fetchNextPage, hasNextPage, isFetchingNextPage } =
    usePosts('micro', 5)

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
        <div className='animate-pulse space-y-6'>
          {Array.from({ length: 3 }).map((_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: static array.
            <div key={i} className='space-y-2 pb-6 border-b border-border/20'>
              <div className='h-4 w-24 bg-muted/50 rounded' />
              <div className='h-3 w-full bg-muted/50 rounded' />
              <div className='h-3 w-3/4 bg-muted/50 rounded' />
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className='max-w-2xl mx-auto px-4 py-8'>
      <div className='flex flex-row items-baseline justify-between gap-4 mb-8 border-b pb-4 border-border/40'>
        <div className='flex items-baseline gap-6'>
          <h1 className='text-2xl font-black tracking-tight'>Tweet</h1>
          <Link
            to='/editorial'
            className='flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors relative group'>
            Editorial
            <span className='absolute bottom-[-17px] left-0 right-0 h-0.5 bg-foreground scale-x-0 group-hover:scale-x-100 transition-transform origin-left' />
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
      <div className='grid gap-0'>
        {filteredData?.map((post) => (
          <Link
            key={post.id}
            to='/tweet/$slug'
            params={{ slug: post.slug }}
            className='block px-1 py-5 border-b border-border/30 transition-colors hover:bg-muted/30 cursor-pointer group'>
            <div className='flex items-center gap-2 mb-2'>
              <span className='font-bold text-sm text-foreground'>
                {post.title}
              </span>
              <span className='text-muted-foreground/40'>·</span>
              {post.createdAt && (
                <span className='font-mono text-xs text-muted-foreground/50'>
                  {new Date(post.createdAt).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric'
                  })}
                </span>
              )}
            </div>
            <div className='prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-p:leading-relaxed prose-a:pointer-events-none prose-headings:text-base prose-headings:my-2 prose-ul:my-1 prose-ol:my-1 prose-li:my-0'>
              <MDXRendrr mdxString={post.compiledContent ?? post.content} />
            </div>
            {post.tags && post.tags.length > 0 && (
              <div className='flex flex-wrap gap-1.5 mt-3'>
                {post.tags.map((t) => (
                  <span
                    key={t}
                    className='text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50'>
                    #{t}
                  </span>
                ))}
              </div>
            )}
          </Link>
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
