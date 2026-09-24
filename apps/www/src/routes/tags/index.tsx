import { createPageComponent } from '@/components/PageApp'
import { createFileRoute } from '@/lib/page'
import { Link } from '@/lib/navigation'
import { QueryError } from '@/components/QueryError'
import { usePostTags } from '@/lib/http'
import { generateSEOHead, STATIC_PAGE_SEO } from '@/lib/seo'

export const Route = createFileRoute('/tags/')({
  component: TagsIndexPage,
  head: () => generateSEOHead(STATIC_PAGE_SEO.tags)
})

function TagsIndexPage() {
  const { data: tags, error, isPending, refetch } = usePostTags()

  return (
    <div className='mx-auto max-w-2xl px-4 py-8'>
      <h1 className='mb-6 text-lg font-black tracking-tight text-foreground'>Tags</h1>

      {isPending ? (
        <div className='flex flex-wrap gap-2'>
          {Array.from({ length: 12 }, (_, i) => `skeleton-${i}`).map((key) => (
            <div key={key} className='h-7 w-20 animate-pulse rounded-sm bg-muted/50' />
          ))}
        </div>
      ) : error ? (
        <QueryError error={error} onRetry={() => refetch()} />
      ) : tags.length === 0 ? (
        <p className='text-base text-muted-foreground'>No tags yet.</p>
      ) : (
        <div className='flex flex-wrap gap-x-4 gap-y-2'>
          {tags.map((tag) => (
            <Link
              key={tag}
              to='/tags/$tag'
              params={{ tag }}
              className='text-base text-muted-foreground no-underline transition-colors hover:text-foreground'>
              #{tag}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

export const Page = createPageComponent(Route)
