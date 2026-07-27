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
    <div className='flex flex-col lg:flex-row gap-4 lg:gap-6 items-start pt-2 mb-6 pb-6 border-b border-border/40'>
      <img
        src={show.thumbnailUrl || DEFAULT_IMAGE_URL}
        alt={show.title}
        className='hidden lg:block w-40 h-40 object-cover border rounded-sm border-border bg-background shrink-0'
      />
      <div className='flex-1 min-w-0 space-y-2 sm:space-y-3'>
        <h2 className='text-xl sm:text-3xl font-black tracking-tight mt-0'>{show.title}</h2>
        {hostNames && (
          <Link
            to='/shows/$showSlug'
            params={{ showSlug: show.slug }}
            className='block text-sm text-muted-foreground hover:text-foreground transition-colors'>
            Hosted by {hostNames}
          </Link>
        )}
        {show.description && (
          <p className='hidden sm:block text-sm text-foreground/70 line-clamp-4'>
            {show.description}
          </p>
        )}
        <div className='flex flex-wrap items-center gap-3 pt-1'>
          <div className='w-full sm:w-auto'>
            <SubscribeButton showId={show.id} showTitle={show.title} />
          </div>
          <Link
            to='/shows/$showSlug'
            params={{ showSlug: show.slug }}
            className='text-sm font-medium text-primary hover:opacity-80'>
            View show page
          </Link>
        </div>
      </div>
    </div>
  )
}
