import { Badge } from '@gbfm/ui'
import type { SelectMdxCompiledMicroPost } from '@gbfm/vps/schemas'
import { Link } from '@tanstack/react-router'
import { Tag } from 'lucide-react'
import { MDXRendrr } from '@/components/MDXRendrr'
import { TweetAuthorRow } from '@/components/TweetAuthorRow'
import { TweetMusicEntityCard } from '@/components/TweetMusicEntityCard'

type Props = {
  post: SelectMdxCompiledMicroPost
}

export function TweetListCard({ post }: Props) {
  const hasMusicEntity = Boolean(post.musicEntityType && post.musicEntityId)
  const tweetLinkLabel = post.title ? `Open tweet: ${post.title}` : 'Open tweet'

  return (
    <article className='relative block overflow-hidden rounded-lg border border-border/60 bg-card/40 p-4 shadow-sm transition-colors hover:bg-card/70 sm:p-5'>
      <Link
        aria-label={tweetLinkLabel}
        className='absolute inset-0 z-0 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
        params={{ slug: post.slug }}
        to='/tweet/$slug'
      />
      <div className='pointer-events-none relative z-10 space-y-3'>
        <TweetAuthorRow
          creators={post.creators ?? []}
          createdAt={post.createdAt}
          interactive={false}
        />

        {post.title && <h2 className='text-base font-medium leading-snug'>{post.title}</h2>}

        <div className='prose prose-sm dark:prose-invert max-w-none prose-p:my-0 prose-p:leading-relaxed prose-headings:text-base prose-headings:my-1 prose-a:text-foreground prose-a:underline prose-a:pointer-events-none [&_iframe]:hidden [&_img]:hidden [&_video]:hidden [&_audio]:hidden line-clamp-4'>
          <MDXRendrr mdxString={post.compiledContent ?? post.content ?? ''} />
        </div>

        {hasMusicEntity && post.musicEntityType && post.musicEntityId && (
          <TweetMusicEntityCard entityType={post.musicEntityType} entityId={post.musicEntityId} />
        )}

        {post.tags && post.tags.length > 0 && (
          <div className='flex flex-wrap gap-1.5 pt-1'>
            {post.tags.map((t) => (
              <Badge
                key={t}
                variant='secondary'
                className='text-[10px] uppercase tracking-widest px-2 py-0.5 rounded-sm font-bold bg-muted/50 text-muted-foreground border-none'>
                <Tag className='w-3 h-3 mr-1 opacity-50' />
                {t}
              </Badge>
            ))}
          </div>
        )}
      </div>
    </article>
  )
}
