import { Link } from '@tanstack/react-router'
import { useMicroPostById } from '@/lib/http'
import { TweetAuthorRow } from '@/components/TweetAuthorRow'

type Props = {
  quotedPostId: string
}

const SNIPPET_MAX_LENGTH = 180

function toSnippet(text: string): string {
  const flattened = text.replace(/\s+/g, ' ').trim()
  return flattened.length > SNIPPET_MAX_LENGTH
    ? `${flattened.slice(0, SNIPPET_MAX_LENGTH).trimEnd()}…`
    : flattened
}

export function TweetQuoteCard({ quotedPostId }: Props) {
  const { data, isPending } = useMicroPostById(quotedPostId)

  if (isPending) {
    return (
      <div className='not-prose overflow-hidden rounded-md border border-border/50 bg-muted/20 animate-pulse p-3'>
        <div className='mb-2 flex items-center gap-3'>
          <div className='h-10 w-10 rounded-sm bg-muted' />
          <div className='space-y-1.5'>
            <div className='h-3 w-24 rounded-full bg-muted' />
            <div className='h-2.5 w-16 rounded-full bg-muted' />
          </div>
        </div>
        <div className='h-3 w-3/4 rounded-full bg-muted' />
      </div>
    )
  }

  if (!data) {
    return null
  }

  const snippet = toSnippet(data.content ?? data.title ?? '')

  return (
    <Link
      to='/tweet/$slug'
      params={{ slug: data.slug }}
      className='not-prose block overflow-hidden rounded-md border border-border/50 bg-muted/20 p-3 transition-colors hover:bg-muted/30'>
      <TweetAuthorRow
        creators={data.creators ?? []}
        createdAt={data.createdAt}
        interactive={false}
      />
      {snippet ? <p className='mt-2 truncate text-sm text-muted-foreground'>{snippet}</p> : null}
    </Link>
  )
}
