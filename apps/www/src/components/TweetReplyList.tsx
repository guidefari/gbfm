import { useRouter } from '@tanstack/react-router'
import { MessageCircle } from 'lucide-react'
import type { MouseEvent } from 'react'
import { MDXRendrr } from '@/components/MDXRendrr'
import { TweetAuthorRow } from '@/components/TweetAuthorRow'
import { TweetMusicEntityCard } from '@/components/TweetMusicEntityCard'
import { TweetQuoteCard } from '@/components/TweetQuoteCard'
import { useMicroPostReplies } from '@/lib/http'

type Props = {
  parentSlug: string
}

export function TweetReplyList({ parentSlug }: Props) {
  const router = useRouter()
  const { data, isPending } = useMicroPostReplies(parentSlug)

  if (isPending) {
    return (
      <div className='space-y-2'>
        {[0, 1].map((i) => (
          <div
            key={i}
            className='animate-pulse space-y-2 rounded-lg border border-border/40 bg-card/40 p-3'>
            <div className='h-3 w-24 rounded-full bg-muted' />
            <div className='h-3 w-2/3 rounded-full bg-muted' />
          </div>
        ))}
      </div>
    )
  }

  const replies = data?.data ?? []

  if (replies.length === 0) {
    return null
  }

  const isInteractiveTarget = (event: MouseEvent) =>
    event.target instanceof HTMLElement &&
    Boolean(event.target.closest('a, button, input, textarea, select, [role="menuitem"]'))

  return (
    <div>
      <div className='mb-2 flex items-center gap-1.5 text-base text-muted-foreground'>
        <MessageCircle className='h-3.5 w-3.5' />
        <span>
          {replies.length} {replies.length === 1 ? 'reply' : 'replies'}
        </span>
      </div>
      {replies.map((reply, index) => {
        const hasMusicEntity = Boolean(reply.musicEntityType && reply.musicEntityId)
        const isLast = index === replies.length - 1
        return (
          <div key={reply.id} className='relative'>
            {!isLast && (
              <div className='absolute left-[35px] top-full h-2 w-px bg-border/60' aria-hidden />
            )}
            <div
              role='link'
              tabIndex={0}
              onClick={(event) => {
                if (isInteractiveTarget(event)) return
                router.navigate({ to: '/tweet/$slug', params: { slug: reply.slug } })
              }}
              onKeyDown={(event) => {
                if (event.key !== 'Enter') return
                if (event.target !== event.currentTarget) return
                router.navigate({ to: '/tweet/$slug', params: { slug: reply.slug } })
              }}
              className={`cursor-pointer space-y-2 rounded-lg border border-border/40 bg-card p-3 transition-colors hover:bg-card/80 ${isLast ? '' : 'mb-2'}`}>
              <TweetAuthorRow
                creators={reply.creators ? [...reply.creators] : []}
                createdAt={reply.createdAt}
              />
              <div className='prose prose-sm dark:prose-invert max-w-none prose-p:leading-relaxed prose-p:my-0 prose-a:text-foreground prose-a:underline'>
                <MDXRendrr mdxString={reply.compiledContent ?? reply.content ?? ''} />
              </div>
              {hasMusicEntity && reply.musicEntityType && reply.musicEntityId && (
                <TweetMusicEntityCard
                  entityType={reply.musicEntityType}
                  entityId={reply.musicEntityId}
                />
              )}
              {reply.quotedPostId && <TweetQuoteCard quotedPostId={reply.quotedPostId} />}
              {Boolean(reply.replyCount) && (
                <div className='flex items-center gap-1.5 text-xs text-muted-foreground'>
                  <MessageCircle className='h-3 w-3' />
                  <span>
                    {reply.replyCount} {reply.replyCount === 1 ? 'reply' : 'replies'}
                  </span>
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
