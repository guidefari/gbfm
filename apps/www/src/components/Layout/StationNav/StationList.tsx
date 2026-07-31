import { Link } from '@tanstack/react-router'
import { useAllShows } from '@/lib/http'
import { cn } from '@/lib/utils'

export function StationList({
  activeSlug,
  onNavigate
}: {
  activeSlug?: string
  onNavigate?: () => void
}) {
  const { data, isPending } = useAllShows()

  if (isPending) {
    return (
      <ul className='flex list-none flex-col gap-1 pl-0'>
        {Array.from({ length: 3 }, (_, index) => `station-skeleton-${index}`).map((id) => (
          <li key={id} className='flex list-none items-center gap-3 px-3 py-2'>
            <span className='h-2 w-2 shrink-0 bg-border' />
            <span className='h-3 w-32 bg-muted/60 animate-pulse' />
          </li>
        ))}
      </ul>
    )
  }

  if (data.length === 0) {
    return <p className='px-3 py-2 text-sm text-muted-foreground'>No stations on air yet.</p>
  }

  return (
    <ul className='flex list-none flex-col gap-1 pl-0'>
      {data.map((show) => {
        const isActive = show.slug === activeSlug

        return (
          <li key={show.id} className='list-none'>
            <Link
              to='/shows'
              search={{ show: show.slug }}
              onClick={onNavigate}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                'flex items-center gap-3 rounded-sm px-3 py-2 text-sm transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                isActive
                  ? 'bg-secondary text-highlight'
                  : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
              )}>
              <span
                aria-hidden
                className={cn(
                  'h-2 w-2 shrink-0 rounded-full border',
                  isActive ? 'border-highlight bg-highlight' : 'border-muted-foreground/50'
                )}
              />
              <span className='min-w-0 flex-1 truncate font-medium'>{show.title}</span>
            </Link>
          </li>
        )
      })}
    </ul>
  )
}
