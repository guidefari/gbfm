import { Badge, Button } from '@gbfm/ui'
import { Link } from '@tanstack/react-router'
import { ExternalLink } from 'lucide-react'
import type { BlueskyPostSource as BlueskyPostSourceSchema } from '@gbfm/api/bluesky'

type PostSource = typeof BlueskyPostSourceSchema.Type

const explanation: Record<string, string> = {
  conflict: 'Edited here and changed on Bluesky, so the import left it alone.',
  error: 'The import could not finish this post.',
  unavailable: 'The original post could not be read from Bluesky.'
}

export function NeedsAttentionList({
  sources,
  isPending,
  dismissingId,
  onDismiss
}: {
  sources: ReadonlyArray<PostSource>
  isPending: boolean
  dismissingId: string | null
  onDismiss: (sourceId: string) => void
}) {
  if (isPending) {
    return <p className='text-xs text-muted-foreground'>Checking for problems…</p>
  }

  if (sources.length === 0) {
    return <p className='text-xs text-muted-foreground'>Nothing needs attention.</p>
  }

  return (
    <ul className='space-y-3'>
      {sources.map((source) => (
        <li key={source.id} className='space-y-3 rounded-sm border p-4'>
          <div className='flex flex-wrap items-center gap-2'>
            <Badge variant='secondary'>{source.sourceStatus}</Badge>
            <span className='text-xs text-muted-foreground'>
              {new Date(source.sourceCreatedAt).toLocaleDateString()}
            </span>
            {source.authorHandle ? (
              <span className='text-xs text-muted-foreground'>{source.authorHandle}</span>
            ) : null}
          </div>

          {source.sourceText ? (
            <p className='line-clamp-3 text-sm text-foreground'>{source.sourceText}</p>
          ) : null}

          <p className='text-xs text-muted-foreground'>
            {explanation[source.sourceStatus] ?? 'This import needs a look.'}
          </p>

          {source.lastError ? <p className='text-xs text-destructive'>{source.lastError}</p> : null}

          <div className='flex flex-wrap gap-2'>
            {source.postSlug ? (
              <Button variant='outline' size='sm' asChild>
                <Link to='/new/tweet' search={{ edit: source.postSlug }}>
                  Open draft
                </Link>
              </Button>
            ) : null}
            <Button variant='outline' size='sm' asChild>
              <a href={source.publicUrl} target='_blank' rel='noreferrer'>
                <ExternalLink className='mr-2 size-4' />
                View on Bluesky
              </a>
            </Button>
            <Button
              variant='ghost'
              size='sm'
              onClick={() => onDismiss(source.id)}
              disabled={dismissingId === source.id}>
              {dismissingId === source.id ? 'Dismissing…' : 'Dismiss'}
            </Button>
          </div>
        </li>
      ))}
    </ul>
  )
}
