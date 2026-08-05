import { MessageCircle } from 'lucide-react'
import { TweetReplyCard } from '@/components/TweetReplyCard'
import { useMicroPostReplies } from '@/lib/http'

type Props = {
  parentSlug: string
  depth?: number
}

export function TweetReplyList({ parentSlug, depth = 0 }: Props) {
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

  return (
    <div>
      {depth === 0 && (
        <div className='mb-3 flex items-center gap-3 text-xs text-muted-foreground'>
          <span className='flex items-center gap-1.5'>
            <MessageCircle className='h-3.5 w-3.5' />
            {replies.length} {replies.length === 1 ? 'reply' : 'replies'}
          </span>
          <span aria-hidden className='h-px flex-1 bg-border/60' />
        </div>
      )}
      {replies.map((reply, index) => (
        <TweetReplyCard
          key={reply.id}
          reply={reply}
          depth={depth}
          isLast={index === replies.length - 1}
        />
      ))}
    </div>
  )
}
