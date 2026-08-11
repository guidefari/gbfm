import { createFileRoute } from '@tanstack/react-router'
import { Effect } from 'effect'
import { MDXRendrr } from '@/components/MDXRendrr'
import { RouteError } from '@/components/RouteError'
import { TweetActionsMenu } from '@/components/TweetActionsMenu'
import { TweetAuthorRow } from '@/components/TweetAuthorRow'
import { TweetCardActions } from '@/components/TweetCardActions'
import {
  isMusicEntityType,
  musicEntityLinksQueryOptions,
  musicEntityQueryOptions,
  TweetMusicEntityCard
} from '@/components/TweetMusicEntityCard'
import { TweetNav } from '@/components/TweetNav'
import { TweetParentPreview } from '@/components/TweetParentPreview'
import { TweetQuoteCard } from '@/components/TweetQuoteCard'
import { TweetReplyComposer } from '@/components/TweetReplyComposer'
import { TweetReplyList } from '@/components/TweetReplyList'
import { TweetTagLinks } from '@/components/TweetTagLinks'
import { useSession } from '@/lib/auth-client'
import { getApiClient } from '@/lib/api-client'
import {
  microPostByIdQueryOptions,
  microPostRepliesQueryOptions,
  useMicroPostReplies
} from '@/lib/http'
import { queryClient } from '@/lib/query-client'
import { generateMicroPostSEO, generateSEOMeta } from '@/lib/seo'
import { captureException } from '@/services/analytics'

type PostDependencyReference = {
  musicEntityType?: string | null
  musicEntityId?: string | null
  quotedPostId?: string | null
}

const prefetchPostDependencies = (post: PostDependencyReference): Array<Promise<void>> => {
  const prefetches: Array<Promise<void>> = []
  if (post.musicEntityType && isMusicEntityType(post.musicEntityType) && post.musicEntityId) {
    prefetches.push(
      queryClient.prefetchQuery(musicEntityQueryOptions(post.musicEntityType, post.musicEntityId)),
      queryClient.prefetchQuery(
        musicEntityLinksQueryOptions(post.musicEntityType, post.musicEntityId)
      )
    )
  }
  if (post.quotedPostId) {
    prefetches.push(queryClient.prefetchQuery(microPostByIdQueryOptions(post.quotedPostId)))
  }
  return prefetches
}

export const Route = createFileRoute('/tweet/$slug')({
  component: TweetPostPage,
  errorComponent: ({ error }) => (
    <div className='max-w-3xl px-4 pt-8 mx-auto'>
      <RouteError error={error} />
    </div>
  ),
  loader: async ({ params, preload }) => {
    const client = await getApiClient()
    const post = await Effect.runPromise(
      client.post
        .getMicroPostBySlug({ params: { slug: params.slug } })
        .pipe(
          Effect.tapError((error) =>
            captureException(error, { endpoint: 'post.getMicroPostBySlug' })
          )
        )
    )
    const repliesPromise = queryClient
      .fetchQuery(microPostRepliesQueryOptions(params.slug))
      .catch(() => undefined)
    const rootDependenciesPromise = Promise.all([
      ...prefetchPostDependencies(post),
      ...(post.parentPostId
        ? [queryClient.prefetchQuery(microPostByIdQueryOptions(post.parentPostId))]
        : [])
    ])
    const dependenciesReady = Promise.all([repliesPromise, rootDependenciesPromise]).then(
      ([replies]) =>
        replies ? Promise.all(replies.data.flatMap(prefetchPostDependencies)) : undefined
    )
    if (preload) await dependenciesReady

    return {
      post: {
        ...post,
        bannerImageUrl: null,
        createdAt: new Date(post.createdAt),
        updatedAt: new Date(post.updatedAt),
        tags: post.tags ? [...post.tags] : null,
        creators: post.creators ? [...post.creators] : undefined
      }
    }
  },
  head: ({ loaderData, params }) => {
    if (!loaderData?.post) {
      return {
        meta: [
          { title: 'Tweet | goosebumps.fm' },
          { name: 'description', content: 'Short updates on goosebumps.fm' }
        ]
      }
    }

    const seoData = generateMicroPostSEO(loaderData.post, params.slug)
    return { meta: generateSEOMeta(seoData) }
  }
})

function TweetPostPage() {
  const { slug } = Route.useParams()
  const { post } = Route.useLoaderData()
  const { data: session } = useSession()
  const user = session?.user
  const { data: repliesData } = useMicroPostReplies(slug)
  const replyCount = repliesData?.data.length ?? 0

  const scrollToReplies = () => {
    document.getElementById('replies')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  if (!post) return null

  const hasMusicEntity = Boolean(post.musicEntityType && post.musicEntityId)
  const canEdit = Boolean(
    user && (user.role === 'admin' || post.creators?.some((creator) => creator.id === user.id))
  )
  const createdAt = post.createdAt ? new Date(post.createdAt).getTime() : null
  const updatedAt = post.updatedAt ? new Date(post.updatedAt).getTime() : null
  const editedAt = createdAt && updatedAt && updatedAt > createdAt ? post.updatedAt : null

  return (
    <div className='max-w-3xl px-4 py-8 mx-auto'>
      <div className='mb-6 lg:mb-0'>
        <TweetNav slug={slug} />
      </div>
      {post.parentPostId && <TweetParentPreview parentPostId={post.parentPostId} />}
      <article className='space-y-4 rounded-lg border border-border/60 bg-card/60 p-4 shadow-sm sm:p-5'>
        <div className='space-y-1'>
          <TweetAuthorRow creators={post.creators ?? []} createdAt={post.createdAt} />
          {editedAt && (
            <p className='pl-[52px] font-mono text-[11px] tracking-wider text-muted-foreground/60'>
              Edited{' '}
              {new Date(editedAt).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
              })}
            </p>
          )}
        </div>

        {post.title && (
          <h1 className='text-lg font-medium leading-snug tracking-tight'>{post.title}</h1>
        )}

        <div className='prose prose-base dark:prose-invert max-w-none prose-headings:font-black prose-headings:tracking-tighter prose-p:leading-relaxed prose-p:my-0 prose-a:text-foreground prose-a:underline'>
          <MDXRendrr mdxString={post.compiledContent ?? post.content ?? ''} />
        </div>

        {hasMusicEntity && post.musicEntityType && post.musicEntityId && (
          <TweetMusicEntityCard entityType={post.musicEntityType} entityId={post.musicEntityId} />
        )}

        {post.quotedPostId && <TweetQuoteCard quotedPostId={post.quotedPostId} />}

        {post.tags && post.tags.length > 0 && (
          <div className='pt-1'>
            <TweetTagLinks tags={post.tags} />
          </div>
        )}

        <div className='border-t border-border/40 pt-3'>
          <TweetCardActions
            post={post}
            slug={slug}
            canEdit={canEdit}
            replyCount={replyCount}
            onReplyCountClick={scrollToReplies}
          />
        </div>
      </article>
      <div id='replies' className='mt-6 scroll-mt-4 space-y-4'>
        <TweetReplyComposer parentSlug={slug} />
        <TweetReplyList parentSlug={slug} />
      </div>
      <TweetActionsMenu />
    </div>
  )
}
