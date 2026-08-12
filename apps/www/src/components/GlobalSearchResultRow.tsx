import { Link } from '@tanstack/react-router'
import type { SearchResultItem } from '@gbfm/api/search'

type Props = {
  result: SearchResultItem
  onClick: () => void
}

const typeLabel = new Map([
  ['show', 'show'],
  ['mix', 'mix'],
  ['track', 'track'],
  ['misc', 'audio'],
  ['micro', 'tweet'],
  ['post', 'editorial']
])

function resultLinkProps(result: SearchResultItem) {
  if (result.type === 'show') {
    return { to: '/shows/$showSlug' as const, params: { showSlug: result.slug } }
  }
  if (result.type === 'micro') {
    return { to: '/tweet/$slug' as const, params: { slug: result.slug } }
  }
  if (result.type === 'post') {
    return { to: '/editorial/$slug' as const, params: { slug: result.slug } }
  }
  if (result.showSlug) {
    return { to: '/shows/$showSlug' as const, params: { showSlug: result.showSlug } }
  }
  return null
}

export function GlobalSearchResultRow({ result, onClick }: Props) {
  const linkProps = resultLinkProps(result)
  const label = typeLabel.get(result.type) ?? result.type

  const content = (
    <>
      <div className='flex items-center gap-2'>
        <span className='shrink-0 rounded-sm bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground'>
          {label}
        </span>
        <span className='truncate'>
          {result.title || result.description?.slice(0, 80) || '(untitled)'}
        </span>
      </div>
      {result.description && (
        <div className='mt-0.5 truncate text-xs text-muted-foreground'>{result.description}</div>
      )}
    </>
  )

  if (!linkProps) {
    return (
      <div className='block truncate border-b border-border/30 px-3 py-2 text-base text-muted-foreground last:border-b-0'>
        {content}
      </div>
    )
  }

  return (
    <Link
      {...linkProps}
      onClick={onClick}
      className='block truncate border-b border-border/30 px-3 py-2 text-base last:border-b-0 hover:bg-muted/50'>
      {content}
    </Link>
  )
}
