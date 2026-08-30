import { useQuery } from '@tanstack/react-query'
import { CornerDownRight } from 'lucide-react'
import { microPostByIdQueryOptions } from '@/lib/http'

type Props = {
  parentPostId?: string
}

const SNIPPET_MAX_LENGTH = 60

function toSnippet(text: string): string {
  const flattened = text.replace(/\s+/g, ' ').trim()
  return flattened.length > SNIPPET_MAX_LENGTH
    ? `${flattened.slice(0, SNIPPET_MAX_LENGTH).trimEnd()}…`
    : flattened
}

export function TweetSearchReplyContext({ parentPostId }: Props) {
  const { data } = useQuery({
    ...microPostByIdQueryOptions(parentPostId ?? ''),
    enabled: Boolean(parentPostId)
  })

  const snippet = data ? toSnippet(data.title ?? data.content ?? '') : ''

  return (
    <div className='mt-0.5 flex items-center gap-1 truncate text-xs text-muted-foreground'>
      <CornerDownRight className='h-3 w-3 shrink-0 opacity-60' />
      <span className='truncate'>{snippet ? `replying to ${snippet}` : 'reply'}</span>
    </div>
  )
}
