import { Link } from '@tanstack/react-router'
import { useMicroPostById } from '@/lib/http'
import { TweetAuthorRow } from '@/components/TweetAuthorRow'

type Props = {
  parentPostId: string
}

const SNIPPET_MAX_LENGTH = 140

function toSnippet(text: string): string {
  const flattened = text.replace(/\s+/g, ' ').trim()
  return flattened.length > SNIPPET_MAX_LENGTH
    ? `${flattened.slice(0, SNIPPET_MAX_LENGTH).trimEnd()}…`
    : flattened
}

export function TweetParentPreview({ parentPostId }: Props) {
  const { data, isPending } = useMicroPostById(parentPostId)

  if (isPending) {
    return (
      <div className='pb-4'>
        <div className='animate-pulse space-y-2 rounded-lg border border-border/40 bg-card p-3'>
          <div className='h-3 w-24 rounded-full bg-muted' />
          <div className='h-3 w-2/3 rounded-full bg-muted' />
        </div>
        <div className='relative h-2'>
          <div className='absolute left-5 top-0 h-2 w-px bg-border/60' aria-hidden />
        </div>
      </div>
    )
  }

  if (!data) {
    return null
  }

  const snippet = toSnippet(data.content ?? data.title ?? '')

  return (
    <div className='pb-4'>
      <Link
        to='/tweet/$slug'
        params={{ slug: data.slug }}
        className='block overflow-hidden rounded-lg border border-border/40 bg-card p-3 opacity-80 transition-opacity hover:opacity-100'>
        <TweetAuthorRow
          creators={data.creators ?? []}
          createdAt={data.createdAt}
          interactive={false}
        />
        {snippet ? <p className='mt-2 truncate text-sm text-muted-foreground'>{snippet}</p> : null}
      </Link>
      <div className='relative h-2'>
        <div className='absolute left-5 top-0 h-2 w-px bg-border/60' aria-hidden />
      </div>
    </div>
  )
}
