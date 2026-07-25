import { createFileRoute, Link } from '@tanstack/react-router'
import { useMemo } from 'react'
import { z } from 'zod'
import { LoadMoreTrigger } from '@/components/LoadMoreTrigger'
import { PostsNav } from '@/components/PostsNav'
import { QueryError } from '@/components/QueryError'
import { TweetListCard } from '@/components/TweetListCard'
import { useMicroPosts } from '@/lib/http'
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
  const { data, error, isPending, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useMicroPosts(5)

  const allTags = useMemo(() => {
    if (!data) return []
    const tagSet = new Set<string>()
    data.forEach((post) => {
      post.tags?.forEach((t) => {
        tagSet.add(t)
      })
    })
    return Array.from(tagSet).toSorted()
  }, [data])

  const filteredData = useMemo(() => {
    if (!tag || !data) return data
    return data.filter((post) => post.tags?.includes(tag))
  }, [data, tag])

  if (error) {
    return (
      <div className='max-w-3xl mx-auto px-4 py-8'>
        <PostsNav active='tweets' />
        <QueryError error={error} onRetry={() => refetch()} />
      </div>
    )
  }

  if (isPending) {
    return (
      <div className='max-w-3xl mx-auto px-4 py-8'>
        <PostsNav active='tweets' />
        <div className='animate-pulse space-y-4'>
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              // oxlint-disable-next-line react/no-array-index-key
              key={i}
              className='space-y-3 overflow-hidden rounded-lg border border-border/40 bg-card/30 p-4 sm:p-5'>
              <div className='flex items-center gap-3'>
                <div className='h-12 w-12 shrink-0 rounded-sm bg-muted/60' />
                <div className='flex-1 space-y-2'>
                  <div className='h-3.5 w-28 rounded bg-muted/60' />
                  <div className='h-2.5 w-40 rounded bg-muted/50' />
                </div>
              </div>
              <div className='space-y-2'>
                <div className='h-5 w-48 rounded bg-muted/60' />
                <div className='h-3 w-full rounded bg-muted/50' />
                <div className='h-3 w-full rounded bg-muted/50' />
                <div className='h-3 w-2/3 rounded bg-muted/50' />
              </div>
              {i % 2 === 0 && (
                <div className='flex gap-4 rounded-md border border-border/40 bg-muted/20 p-3'>
                  <div className='h-24 w-24 shrink-0 rounded-sm bg-muted/60' />
                  <div className='flex-1 space-y-2 self-center'>
                    <div className='h-2.5 w-12 rounded bg-muted/50' />
                    <div className='h-4 w-3/4 rounded bg-muted/60' />
                    <div className='h-3 w-1/2 rounded bg-muted/50' />
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className='max-w-3xl mx-auto px-4 py-8'>
      <PostsNav active='tweets' />

      {allTags.length > 0 && <TagFilterStrip tags={allTags} activeTag={tag} />}

      <div className='grid gap-4'>
        {filteredData?.length === 0 && (
          <p className='py-8 text-center text-sm text-muted-foreground'>
            No tweets {tag ? `tagged "${tag}"` : 'yet'}.
          </p>
        )}

        {filteredData?.map((post) => (
          <TweetListCard key={post.id} post={post} />
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

function TagFilterStrip({ tags, activeTag }: { tags: string[]; activeTag: string | undefined }) {
  return (
    <div className='-mx-4 mb-6 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'>
      <div className='flex w-max items-center gap-x-4 text-sm'>
        <TagLink label='all' to={null} active={!activeTag} />
        {tags.map((t) => (
          <TagLink key={t} label={t} to={t} active={activeTag === t} />
        ))}
      </div>
    </div>
  )
}

function TagLink({ label, to, active }: { label: string; to: string | null; active: boolean }) {
  const base = 'shrink-0 font-mono lowercase tracking-tight transition-colors'
  const styles = active
    ? 'text-foreground underline underline-offset-4 decoration-2'
    : 'text-muted-foreground/70 hover:text-foreground'

  return (
    <Link to='/tweet' search={to ? { tag: to } : {}} className={`${base} ${styles}`}>
      #{label}
    </Link>
  )
}
