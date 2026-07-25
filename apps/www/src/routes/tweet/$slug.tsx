import { Badge } from '@gbfm/ui'
import { createFileRoute, Link, useRouter } from '@tanstack/react-router'
import { Effect } from 'effect'
import { ArrowLeft, Tag } from 'lucide-react'
import { MDXRendrr } from '@/components/MDXRendrr'
import { RouteError } from '@/components/RouteError'
import { TweetActionsMenu } from '@/components/TweetActionsMenu'
import { TweetAuthorRow } from '@/components/TweetAuthorRow'
import { TweetMusicEntityCard } from '@/components/TweetMusicEntityCard'
import { useSession } from '@/lib/auth-client'
import { getApiClient } from '@/lib/api-client'
import { generateMicroPostSEO, generateSEOMeta } from '@/lib/seo'
import { captureException } from '@/services/analytics'

export const Route = createFileRoute('/tweet/$slug')({
  component: TweetPostPage,
  errorComponent: ({ error }) => (
    <RouteError
      error={error}
      backLink={
        <Link
          to='/tweet'
          className='-mb-px inline-flex items-center gap-1 border-b-2 border-transparent pb-3 text-lg font-black tracking-tight text-muted-foreground transition-colors hover:border-border hover:text-foreground'>
          <ArrowLeft className='w-4 h-4' />
          Tweets
        </Link>
      }
    />
  ),
  loader: async ({ params }) => {
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

const backLinkClassName =
  '-mb-px inline-flex items-center gap-1 border-b-2 border-transparent pb-3 text-lg font-black tracking-tight text-muted-foreground transition-colors hover:border-border hover:text-foreground'

function TweetsBackLink() {
  const router = useRouter()

  if (router.history.canGoBack()) {
    return (
      <button type='button' onClick={() => router.history.back()} className={backLinkClassName}>
        <ArrowLeft className='w-4 h-4' />
        Tweets
      </button>
    )
  }

  return (
    <Link to='/tweet' className={backLinkClassName}>
      <ArrowLeft className='w-4 h-4' />
      Tweets
    </Link>
  )
}

function TweetPostPage() {
  const { slug } = Route.useParams()
  const { post } = Route.useLoaderData()
  const { data: session } = useSession()
  const user = session?.user

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
      <nav className='mb-6 flex items-end gap-6 border-b border-border/40'>
        <TweetsBackLink />
      </nav>
      <article className='space-y-4 rounded-lg border border-border/60 bg-card/60 p-4 shadow-sm sm:p-5'>
        <div className='flex items-start justify-between gap-3'>
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
          <TweetActionsMenu post={post} slug={slug} canEdit={canEdit} />
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

        {post.tags && post.tags.length > 0 && (
          <div className='flex flex-wrap gap-1.5 pt-1'>
            {post.tags.map((tag) => (
              <Badge
                key={tag}
                variant='secondary'
                className='text-[10px] tracking-widest px-2 py-0.5 rounded-sm font-bold bg-muted/50 text-muted-foreground border-none'>
                <Tag className='w-3 h-3 mr-1 opacity-50' />
                {tag}
              </Badge>
            ))}
          </div>
        )}
      </article>
    </div>
  )
}
