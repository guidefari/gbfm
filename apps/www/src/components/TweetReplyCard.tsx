import { useRouter } from '@tanstack/react-router'
import type { MouseEvent } from 'react'
import { useState } from 'react'
import { MDXRendrr } from '@/components/MDXRendrr'
import { TweetAuthorRow } from '@/components/TweetAuthorRow'
import { TweetCardActions } from '@/components/TweetCardActions'
import { TweetMusicEntityCard } from '@/components/TweetMusicEntityCard'
import { TweetQuoteCard } from '@/components/TweetQuoteCard'
import { TweetReplyComposer } from '@/components/TweetReplyComposer'
import { TweetReplyList } from '@/components/TweetReplyList'
import { TweetTagLinks } from '@/components/TweetTagLinks'
import { useSession } from '@/lib/auth-client'
import { useMicroPostReplies } from '@/lib/http'
import { cn } from '@/lib/utils'

export const MAX_NESTED_DEPTH = 2

type Reply = NonNullable<ReturnType<typeof useMicroPostReplies>['data']>['data'][number]

const isInteractiveTarget = (event: MouseEvent) =>
  event.target instanceof HTMLElement &&
  Boolean(event.target.closest('a, button, input, textarea, select, [role="menuitem"]'))

export function TweetReplyCard({
  reply,
  depth,
  isLast
}: {
  reply: Reply
  depth: number
  isLast: boolean
}) {
  const router = useRouter()
  const { data: session } = useSession()
  const user = session?.user
  const [showThread, setShowThread] = useState(false)
  const hasMusicEntity = Boolean(reply.musicEntityType && reply.musicEntityId)
  const replyCount = reply.replyCount ?? 0
  const canNest = depth < MAX_NESTED_DEPTH
  const canEdit = Boolean(
    user && (user.role === 'admin' || reply.creators?.some((creator) => creator.id === user.id))
  )

  const openReply = () => router.navigate({ to: '/tweet/$slug', params: { slug: reply.slug } })

  return (
    <div className='relative'>
      {!isLast && (
        <div className='absolute left-[35px] top-full h-2 w-px bg-border/60' aria-hidden />
      )}
      <div
        role='button'
        tabIndex={0}
        aria-label={`Open reply by ${reply.creators?.[0]?.name ?? 'author'}`}
        onClick={(event) => {
          if (isInteractiveTarget(event)) return
          void openReply()
        }}
        onKeyDown={(event) => {
          if (event.key !== 'Enter') return
          if (event.target !== event.currentTarget) return
          void openReply()
        }}
        className={cn(
          'cursor-pointer space-y-2 rounded-lg border border-border/40 bg-card p-3 transition-colors hover:bg-card/80',
          isLast ? '' : 'mb-2'
        )}>
        <TweetAuthorRow
          creators={reply.creators ? [...reply.creators] : []}
          createdAt={reply.createdAt}
        />
        <div className='prose prose-sm dark:prose-invert max-w-none prose-p:leading-relaxed prose-p:my-0 prose-a:text-foreground prose-a:underline'>
          <MDXRendrr mdxString={reply.compiledContent ?? reply.content ?? ''} />
        </div>
        {hasMusicEntity && reply.musicEntityType && reply.musicEntityId && (
          <TweetMusicEntityCard entityType={reply.musicEntityType} entityId={reply.musicEntityId} />
        )}
        {reply.quotedPostId && <TweetQuoteCard quotedPostId={reply.quotedPostId} />}
        {reply.tags && reply.tags.length > 0 && <TweetTagLinks tags={[...reply.tags]} />}

        <TweetCardActions
          post={reply}
          slug={reply.slug}
          canEdit={canEdit}
          replyCount={canNest ? replyCount : undefined}
          replyCountExpanded={canNest ? showThread : undefined}
          onReplyCountClick={canNest ? () => setShowThread((open) => !open) : undefined}
        />

        <div className='flex items-center gap-4'>
          <TweetReplyComposer
            parentSlug={reply.slug}
            compact
            onPosted={() => setShowThread(true)}
          />
          {!canNest && replyCount > 0 && (
            <button
              type='button'
              onClick={openReply}
              className='inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground'>
              Continue thread ({replyCount})
            </button>
          )}
        </div>
      </div>

      {canNest && showThread && (
        <div className='ml-4 border-l border-border/40 pl-3 sm:ml-6 sm:pl-4'>
          <TweetReplyList parentSlug={reply.slug} depth={depth + 1} />
        </div>
      )}
    </div>
  )
}
