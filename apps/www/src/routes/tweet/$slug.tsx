import { Badge } from '@gbfm/ui'
import type { SelectMdxCompiledPost } from '@gbfm/vps/schemas'
import { createFileRoute, Link } from '@tanstack/react-router'
import { ArrowLeft, Tag } from 'lucide-react'
import { MDXRendrr } from '@/components/MDXRendrr'
import { ShareButton } from '@/components/ShareButton'
import { TweetAuthorRow } from '@/components/TweetAuthorRow'
import { TweetMusicEntityCard } from '@/components/TweetMusicEntityCard'
import { fetcher, VPS_BASE_URL } from '@/lib/http'
import { generateMicroPostSEO, generateSEOMeta } from '@/lib/seo'

export const Route = createFileRoute('/tweet/$slug')({
  component: TweetPostPage,
  loader: async ({ params }) => {
    const post = await fetcher<SelectMdxCompiledPost>(
      `${VPS_BASE_URL}/content/posts/${params.slug}`
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

  if (!post) return <div>No data</div>

  const hasMusicEntity = Boolean(post.musicEntityType && post.musicEntityId)
  const titleDuplicatesEntity = hasMusicEntity

  return (
    <div className='max-w-xl px-4 py-6 mx-auto'>
      <Link
        to='/tweet'
        className='inline-flex items-center gap-1 mb-6 text-sm transition-colors text-muted-foreground hover:text-foreground'>
        <ArrowLeft className='w-4 h-4' />
        Tweet
      </Link>
      <article className='space-y-4 rounded-lg border border-border/60 bg-card/60 p-4 shadow-sm sm:p-5'>
        <div className='flex items-start justify-between gap-3'>
          <TweetAuthorRow
            creators={post.creators ?? []}
            createdAt={post.createdAt}
          />
          <ShareButton
            type='post'
            slug={slug}
            variant='ghost'
            size='icon'
            className='h-8 w-8 shrink-0 rounded-md text-muted-foreground hover:text-foreground'
          />
        </div>

        {!titleDuplicatesEntity && post.title && (
          <h1 className='text-xl font-black leading-tight tracking-tight'>
            {post.title}
          </h1>
        )}

        <div className='prose prose-base dark:prose-invert max-w-none prose-headings:font-black prose-headings:tracking-tighter prose-p:leading-relaxed prose-p:my-0 prose-a:text-foreground prose-a:underline'>
          <MDXRendrr mdxString={post.compiledContent ?? post.content} />
        </div>

        {hasMusicEntity && post.musicEntityType && post.musicEntityId && (
          <TweetMusicEntityCard
            entityType={post.musicEntityType}
            entityId={post.musicEntityId}
          />
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
