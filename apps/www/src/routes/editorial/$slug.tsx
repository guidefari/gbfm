import { Badge } from '@gbfm/ui'
import type { SelectMdxCompiledEditorialPost } from '@gbfm/vps/schemas'
import { createFileRoute, Link } from '@tanstack/react-router'
import { ArrowLeft, Tag } from 'lucide-react'
import * as React from 'react'
import { MDXRendrr } from '@/components/MDXRendrr'
import { RouteError } from '@/components/RouteError'
import { ShareButton } from '@/components/ShareButton'
import { DEFAULT_IMAGE_URL } from '@/lib/constants'
import { apiUrl, fetcher } from '@/lib/http'
import { generatePostSEO, generateSEOMeta } from '@/lib/seo'

export const Route = createFileRoute('/editorial/$slug')({
  component: EditorialPostPage,
  errorComponent: ({ error }) => (
    <RouteError
      error={error}
      backLink={
        <Link
          to='/editorial'
          className='inline-flex items-center gap-1 text-sm transition-colors text-muted-foreground hover:text-foreground'>
          <ArrowLeft className='w-4 h-4' />
          Editorial
        </Link>
      }
    />
  ),
  loader: async ({ params }) => {
    const post = await fetcher<SelectMdxCompiledEditorialPost>(
      apiUrl(`/content/posts/editorials/${params.slug}`)
    )
    return { post }
  },
  head: ({ loaderData, params }) => {
    if (!loaderData?.post) {
      return {
        meta: [
          { title: 'Post | goosebumps.fm' },
          { name: 'description', content: 'Read posts on goosebumps.fm' }
        ]
      }
    }

    const seoData = generatePostSEO(loaderData.post, params.slug)
    return { meta: generateSEOMeta(seoData) }
  }
})

function EditorialPostPage() {
  const { slug } = Route.useParams()
  const { post } = Route.useLoaderData()

  if (!post) return null

  return (
    <div className='max-w-3xl px-4 py-6 mx-auto'>
      <Link
        to='/editorial'
        className='inline-flex items-center gap-1 mb-8 text-sm transition-colors text-muted-foreground hover:text-foreground'>
        <ArrowLeft className='w-4 h-4' />
        Editorial
      </Link>
      <PostDetails post={post} slug={slug} />
    </div>
  )
}

function PostDetails({ post, slug }: { post: SelectMdxCompiledEditorialPost; slug: string }) {
  return (
    <div className='space-y-8'>
      <div className='flex flex-col items-start gap-8 md:flex-row'>
        {post.thumbnailUrl && (
          <div className='shrink-0 w-full md:w-64'>
            <img
              src={post.thumbnailUrl || DEFAULT_IMAGE_URL}
              alt={post.title}
              className='object-cover w-full border rounded-sm shadow-lg aspect-video border-border'
            />
          </div>
        )}

        <div className='flex-1 pt-2 space-y-6'>
          <div className='space-y-4'>
            <div className='flex items-start justify-between gap-4'>
              <div className='flex flex-col gap-2'>
                <h1 className='text-4xl font-black leading-none tracking-tighter md:text-5xl'>
                  {post.title}
                </h1>
                {post.creators && post.creators.length > 0 && (
                  <div className='flex flex-wrap gap-x-1.5 gap-y-1 text-xs font-bold tracking-widest text-muted-foreground/80'>
                    <span className='opacity-50'>by</span>
                    {post.creators.map((creator, index) => (
                      <React.Fragment key={creator.id}>
                        {creator.username ? (
                          <Link
                            to='/profile/$username'
                            params={{ username: creator.username }}
                            className='underline-offset-4 hover:underline text-foreground/90 hover:text-foreground'>
                            {creator.name}
                          </Link>
                        ) : (
                          <span>{creator.name}</span>
                        )}
                        {index < (post.creators?.length || 0) - 1 && (
                          <span className='opacity-30'>&</span>
                        )}
                      </React.Fragment>
                    ))}
                  </div>
                )}
              </div>
              <ShareButton type='post' slug={slug} />
            </div>
            {post.description && (
              <p className='pl-4 text-xl italic font-medium leading-relaxed border-l-2 text-muted-foreground border-border/50'>
                {post.description}
              </p>
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
        </div>
      </div>

      {post.tags && post.tags.length > 0 && (
        <div className='flex flex-wrap gap-2'>
          {post.tags.map((tag) => (
            <Badge
              key={tag}
              variant='secondary'
              className='text-[10px] tracking-widest px-2 py-1 rounded-none font-bold bg-muted/50 text-muted-foreground border-none'>
              <Tag className='w-3 h-3 mr-1 opacity-50' />
              {tag}
            </Badge>
          ))}
        </div>
      )}

      <div className='pt-8 border-t border-border/50'>
        <div className='prose prose-base dark:prose-invert max-w-none prose-headings:font-black prose-headings:tracking-tighter prose-p:leading-relaxed prose-a:text-foreground prose-a:underline'>
          <MDXRendrr mdxString={post.compiledContent ?? post.content} />
        </div>
      </div>
    </div>
  )
}
