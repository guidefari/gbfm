import { Link } from '@tanstack/react-router'
import { Artwork } from '@/components/common/Artwork'
import { useAllShows } from '@/lib/http'
import { cn } from '@/lib/utils'

export function StationList({
  activeSlug,
  onNavigate
}: {
  activeSlug?: string
  onNavigate?: () => void
}) {
  const { data, isPending } = useAllShows({ limit: 100 })

  return (
    <div className='flex flex-col gap-1'>
      {!isPending &&
        (data.length === 0 ? (
          <p className='px-3 py-2 text-base text-muted-foreground'>No stations on air yet.</p>
        ) : (
          <ul className='flex max-h-64 list-none flex-col gap-0.5 overflow-y-auto overscroll-contain scrollbar-hide pl-0'>
            {data.map((show) => {
              const isActive = show.slug === activeSlug
              const hostNames = show.hosts?.map((h) => h.name).join(', ')

              return (
                <li key={show.id} className='list-none'>
                  <Link
                    to='/shows'
                    search={{ show: show.slug }}
                    onClick={onNavigate}
                    aria-current={isActive ? 'page' : undefined}
                    className={cn(
                      'flex items-center gap-3 rounded-sm px-2 py-1.5 no-underline transition-colors',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      isActive ? 'bg-secondary text-highlight' : 'text-foreground hover:bg-muted/50'
                    )}>
                    <Artwork
                      src={show.thumbnailUrl}
                      alt={show.title}
                      className='size-10 w-10 shrink-0'
                    />
                    <span className='min-w-0 flex-1'>
                      <span className='block truncate text-base font-semibold'>{show.title}</span>
                      {hostNames ? (
                        <span className='block truncate text-xs text-muted-foreground'>
                          {hostNames}
                        </span>
                      ) : null}
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
        ))}
      <Link
        to='/shows'
        onClick={onNavigate}
        className='px-3 py-1.5 text-xs font-medium text-muted-foreground no-underline hover:text-highlight'>
        All radio shows →
      </Link>
    </div>
  )
}
