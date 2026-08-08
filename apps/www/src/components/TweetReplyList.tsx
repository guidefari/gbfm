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
