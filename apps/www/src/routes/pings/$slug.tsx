import type { SelectMdxCompiledPost } from '@gbfm/vps/schemas'
import { createFileRoute, Link } from '@tanstack/react-router'
import { ArrowLeft, Tag } from 'lucide-react'
import * as React from 'react'
import { MDXRendrr } from '@/components/MDXRendrr'
import { ShareButton } from '@/components/ShareButton'
import { Badge } from '@/components/ui/badge'
import { fetcher, VPS_BASE_URL } from '@/lib/http'
import { generateMicroPostSEO, generateSEOMeta } from '@/lib/seo'

export const Route = createFileRoute('/pings/$slug')({
  component: PingPostPage,
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
          { title: 'Ping | goosebumps.fm' },
          { name: 'description', content: 'Short updates on goosebumps.fm' }
        ]
      }
    }

    const seoData = generateMicroPostSEO(loaderData.post, params.slug)
    return { meta: generateSEOMeta(seoData) }
  }
})

function PingPostPage() {
  const { slug } = Route.useParams()
  const { post } = Route.useLoaderData()

  if (!post) return <div>No data</div>

  return (
    <div className='max-w-2xl px-4 py-6 mx-auto'>
      <Link
        to='/pings'
        className='inline-flex items-center gap-1 mb-8 text-sm transition-colors text-muted-foreground hover:text-foreground'>
        <ArrowLeft className='w-4 h-4' />
        Pings
      </Link>
      <article className='space-y-6'>
        <div className='space-y-3'>
          <div className='flex items-start justify-between gap-4'>
            <h1 className='text-2xl font-black leading-tight tracking-tight'>
              {post.title}
            </h1>
            <ShareButton type='post' slug={slug} />
          </div>
          {post.creators && post.creators.length > 0 && (
            <div className='flex flex-wrap gap-x-1.5 gap-y-1 text-xs font-bold uppercase tracking-widest text-muted-foreground/80'>
              <span className='opacity-50'>by</span>
              {post.creators.map((creator, index) => (
                <React.Fragment key={creator.id}>
                  <span>{creator.name}</span>
                  {index < (post.creators?.length || 0) - 1 && (
                    <span className='opacity-30'>&</span>
                  )}
                </React.Fragment>
              ))}
            </div>
          )}
          {post.createdAt && (
            <p className='font-mono text-sm text-muted-foreground/60'>
              {new Date(post.createdAt).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}
            </p>
          )}
        </div>

        {post.tags && post.tags.length > 0 && (
          <div className='flex flex-wrap gap-2'>
            {post.tags.map((tag) => (
              <Badge
                key={tag}
                variant='secondary'
                className='text-[10px] uppercase tracking-widest px-2 py-1 rounded-none font-bold bg-muted/50 text-muted-foreground border-none'>
                <Tag className='w-3 h-3 mr-1 opacity-50' />
                {tag}
              </Badge>
            ))}
          </div>
        )}

        <div className='pt-6 border-t border-border/50'>
          <div className='prose prose-base dark:prose-invert max-w-none prose-headings:font-black prose-headings:tracking-tighter prose-p:leading-relaxed prose-a:text-foreground prose-a:no-underline hover:prose-a:underline'>
            <MDXRendrr mdxString={post.compiledContent ?? post.content} />
          </div>
        </div>
      </article>
    </div>
  )
}
