import { Badge, Button } from '@gbfm/ui'
import type { SelectMdxCompiledMicroPost } from '@gbfm/vps/schemas'
import { createFileRoute, Link } from '@tanstack/react-router'
import { ArrowLeft, Edit3, Tag } from 'lucide-react'
import { MDXRendrr } from '@/components/MDXRendrr'
import { RouteError } from '@/components/RouteError'
import { ShareButton } from '@/components/ShareButton'
import { TweetAuthorRow } from '@/components/TweetAuthorRow'
import { TweetMusicEntityCard } from '@/components/TweetMusicEntityCard'
import { useSession } from '@/lib/auth-client'
import { fetcher, VPS_BASE_URL } from '@/lib/http'
import { generateMicroPostSEO, generateSEOMeta } from '@/lib/seo'

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
    const post = await fetcher<SelectMdxCompiledMicroPost>(
      `${VPS_BASE_URL}/content/posts/micro/${params.slug}`
    )
    return { post }
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

  if (!post) return null

  const hasMusicEntity = Boolean(post.musicEntityType && post.musicEntityId)
  const canEdit = Boolean(
    user && (user.role === 'admin' || post.creators?.some((creator) => creator.id === user.id))
  )
  const createdAt = post.createdAt ? new Date(post.createdAt).getTime() : null
  const updatedAt = post.updatedAt ? new Date(post.updatedAt).getTime() : null
  const editedAt = createdAt && updatedAt && updatedAt > createdAt ? post.updatedAt : null

  return (
    <div className='max-w-2xl px-4 py-8 mx-auto'>
      <nav className='mb-6 flex items-end gap-6 border-b border-border/40'>
        <Link
          to='/tweet'
          className='-mb-px inline-flex items-center gap-1 border-b-2 border-transparent pb-3 text-lg font-black tracking-tight text-muted-foreground transition-colors hover:border-border hover:text-foreground'>
          <ArrowLeft className='w-4 h-4' />
          Tweets
        </Link>
      </nav>
      <article className='space-y-4 rounded-lg border border-border/60 bg-card/60 p-4 shadow-sm sm:p-5'>
        <div className='flex items-start justify-between gap-3'>
          <div className='space-y-1'>
            <TweetAuthorRow creators={post.creators ?? []} createdAt={post.createdAt} />
            {editedAt && (
              <p className='pl-[52px] font-mono text-[11px] uppercase tracking-wider text-muted-foreground/60'>
                Edited{' '}
                {new Date(editedAt).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric'
                })}
              </p>
            )}
          </div>
          <div className='flex shrink-0 items-center gap-1'>
            {canEdit && (
              <Button
                asChild
                variant='ghost'
                size='icon'
                className='h-8 w-8 rounded-md text-muted-foreground hover:text-foreground'>
                <Link to='/new/tweet' search={{ edit: slug }} aria-label='Edit tweet'>
                  <Edit3 className='h-4 w-4' />
                </Link>
              </Button>
            )}
            <ShareButton
              type='post'
              slug={slug}
              variant='ghost'
              size='icon'
              className='h-8 w-8 rounded-md text-muted-foreground hover:text-foreground'
            />
          </div>
        </div>

        {post.title && (
          <h1 className='text-xl font-black leading-tight tracking-tight'>{post.title}</h1>
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
                className='text-[10px] uppercase tracking-widest px-2 py-0.5 rounded-sm font-bold bg-muted/50 text-muted-foreground border-none'>
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
