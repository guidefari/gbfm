import { createFileRoute, useRouter } from '@tanstack/react-router'
import { MessageCircle } from 'lucide-react'
import type { MouseEvent } from 'react'
import { LoadMoreTrigger } from '@/components/LoadMoreTrigger'
import { MDXRendrr } from '@/components/MDXRendrr'
import { PostsNav } from '@/components/PostsNav'
import { QueryError } from '@/components/QueryError'
import { TweetAuthorRow } from '@/components/TweetAuthorRow'
import { TweetMusicEntityCard } from '@/components/TweetMusicEntityCard'
import { TweetQuoteCard } from '@/components/TweetQuoteCard'
import { TweetTagLinks } from '@/components/TweetTagLinks'
import { useMicroPosts } from '@/lib/http'
import { generateSEOMeta } from '@/lib/seo'

export const Route = createFileRoute('/tags/$tag')({
  component: TagPage,
  head: ({ params }) => ({
    meta: generateSEOMeta({
      title: `#${params.tag}`,
      description: `Posts tagged #${params.tag} on goosebumps.fm`,
      url: `/tags/${params.tag}`
    })
  })
})

type TagPost = ReturnType<typeof useMicroPosts>['data'][number]

function TagPostRow({ post }: { post: TagPost }) {
  const router = useRouter()
  const hasMusicEntity = Boolean(post.musicEntityType && post.musicEntityId)

  const isInteractiveTarget = (event: MouseEvent) =>
    event.target instanceof HTMLElement &&
    Boolean(event.target.closest('a, button, input, textarea, select, [role="menuitem"]'))

  const openPost = () => router.navigate({ to: '/tweet/$slug', params: { slug: post.slug } })

  return (
    <div
      role='button'
      tabIndex={0}
      aria-label={`Open post by ${post.creators?.[0]?.name ?? 'author'}`}
      onClick={(event) => {
        if (isInteractiveTarget(event)) return
        openPost()
      }}
      onKeyDown={(event) => {
        if (event.key !== 'Enter') return
        if (event.target !== event.currentTarget) return
        openPost()
      }}
      className='cursor-pointer space-y-2 rounded-lg border border-border/40 bg-card p-3 transition-colors hover:bg-card/80'>
      <TweetAuthorRow
        creators={post.creators ? [...post.creators] : []}
        createdAt={post.createdAt}
      />

      {post.title && (
        <h2 className='text-base font-medium leading-snug tracking-tight'>{post.title}</h2>
      )}

      {(post.compiledContent || post.content) && (
        <div className='prose prose-sm dark:prose-invert max-w-none prose-p:my-0 prose-p:leading-relaxed prose-a:text-foreground'>
          <MDXRendrr mdxString={post.compiledContent ?? post.content ?? ''} />
        </div>
      )}

      {hasMusicEntity && post.musicEntityType && post.musicEntityId && (
        <TweetMusicEntityCard entityType={post.musicEntityType} entityId={post.musicEntityId} />
      )}

      {post.quotedPostId && <TweetQuoteCard quotedPostId={post.quotedPostId} />}

      {post.tags && post.tags.length > 0 && <TweetTagLinks tags={post.tags} />}

      {Boolean(post.replyCount) && (
        <div className='flex items-center gap-1.5 text-xs text-muted-foreground'>
          <MessageCircle className='h-3 w-3' />
          <span>
            {post.replyCount} {post.replyCount === 1 ? 'reply' : 'replies'}
          </span>
        </div>
      )}
    </div>
  )
}

function TagPage() {
  const { tag } = Route.useParams()
  const { data, error, isPending, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useMicroPosts(undefined, tag)

  return (
    <div className='mx-auto max-w-2xl px-4 py-8'>
      <PostsNav active='tweets' />
      <h1 className='mb-6 text-lg font-black tracking-tight text-foreground'>#{tag}</h1>

      {isPending ? (
        <div className='animate-pulse space-y-2'>
          {Array.from({ length: 4 }, (_, i) => `skeleton-${i}`).map((key) => (
            <div key={key} className='space-y-2 rounded-lg border border-border/40 bg-card/40 p-3'>
              <div className='h-3 w-24 rounded-full bg-muted' />
              <div className='h-3 w-2/3 rounded-full bg-muted' />
            </div>
          ))}
        </div>
      ) : error ? (
        <QueryError error={error} onRetry={() => refetch()} />
      ) : data.length === 0 ? (
        <p className='text-base text-muted-foreground'>Nothing tagged #{tag} yet.</p>
      ) : (
        <>
          <div className='space-y-2'>
            {data.map((post) => (
              <TagPostRow key={post.id} post={post} />
            ))}
          </div>
          <LoadMoreTrigger
            onLoadMore={fetchNextPage}
            hasNextPage={hasNextPage}
            isFetchingNextPage={isFetchingNextPage}
          />
        </>
      )}
    </div>
  )
}
