import { MDXRendrr } from '@/components/MDXRendrr'
import { TweetAuthorRow } from '@/components/TweetAuthorRow'
import { useMicroPostReplies } from '@/lib/http'

type Props = {
  parentSlug: string
}

export function TweetReplyList({ parentSlug }: Props) {
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
    <div className='space-y-2'>
      {replies.map((reply) => (
        <div key={reply.id} className='space-y-2 rounded-lg border border-border/40 bg-card/40 p-3'>
          <TweetAuthorRow
            creators={reply.creators ? [...reply.creators] : []}
            createdAt={reply.createdAt}
          />
          <div className='prose prose-sm dark:prose-invert max-w-none prose-p:leading-relaxed prose-p:my-0 prose-a:text-foreground prose-a:underline'>
            <MDXRendrr mdxString={reply.compiledContent ?? reply.content ?? ''} />
          </div>
        </div>
      ))}
    </div>
  )
}
