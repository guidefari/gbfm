import { Link } from '@tanstack/react-router'
import { DEFAULT_IMAGE_URL } from '@/lib/constants'
import type { ShowWithHosts } from '@/lib/http'
import { SubscribeButton } from './SubscribeButton'

interface SelectedShowBarProps {
  show: ShowWithHosts
}

export function SelectedShowBar({ show }: SelectedShowBarProps) {
  const hostNames = show.hosts?.map((h) => h.name).join(', ')

  return (
    <div className='sticky top-4 z-10 flex items-center gap-3 border-b border-border/40 bg-background/95 py-3 backdrop-blur'>
      <img
        src={show.thumbnailUrl || DEFAULT_IMAGE_URL}
        alt={show.title}
        className='size-10 shrink-0 rounded-sm border border-border bg-background object-cover'
      />
      <div className='min-w-0 flex-1'>
        <h2 className='truncate text-sm font-black tracking-tight text-foreground'>{show.title}</h2>
        {hostNames && (
          <p className='truncate text-xs text-muted-foreground'>Hosted by {hostNames}</p>
        )}
      </div>
      <div className='flex shrink-0 items-center gap-3'>
        <SubscribeButton showId={show.id} showTitle={show.title} />
        <Link
          to='/shows/$showSlug'
          params={{ showSlug: show.slug }}
          className='hidden text-sm font-medium text-primary hover:opacity-80 sm:inline'>
          View show page
        </Link>
      </div>
    </div>
  )
}
