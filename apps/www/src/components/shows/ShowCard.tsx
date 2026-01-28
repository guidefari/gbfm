import { Link } from '@tanstack/react-router'
import { DEFAULT_IMAGE_URL } from '@/lib/constants'
import type { ShowWithHosts } from '@/lib/http'

interface ShowCardProps {
  show: ShowWithHosts
}

export function ShowCard({ show }: ShowCardProps) {
  const hostNames = show.hosts?.map((h) => h.name).join(', ')

  return (
    <Link
      to='/$slug'
      params={{ slug: show.slug }}
      className='flex flex-col gap-2 transition-transform group hover:scale-105'>
      <div className='w-full overflow-hidden border rounded-sm shadow-sm aspect-square border-border bg-background'>
        <img
          src={show.thumbnailUrl || DEFAULT_IMAGE_URL}
          alt={show.title}
          className='object-cover w-full h-full transition-opacity group-hover:opacity-80'
        />
      </div>
      <div className='flex flex-col gap-1'>
        <h2 className='text-sm font-semibold leading-tight transition-colors text-foreground group-hover:text-highlight line-clamp-2'>
          {show.title}
        </h2>
        {hostNames && (
          <p className='text-xs text-muted-foreground line-clamp-1'>
            {hostNames}
          </p>
        )}
      </div>
    </Link>
  )
}
