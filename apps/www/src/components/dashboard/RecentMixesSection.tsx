import { Link } from '@tanstack/react-router'
import { Music } from 'lucide-react'
import { DEFAULT_IMAGE_URL } from '@/lib/constants'
import { useAudioByType } from '@/lib/http'
import { PlayPauseButton } from '../PlayPauseButton'

export function RecentMixesSection() {
  const { data: mixes, isPending } = useAudioByType('mix')

  if (isPending) {
    return (
      <div>
        <h3 className='flex items-center gap-2 text-sm font-medium text-muted-foreground mb-3'>
          <Music className='w-4 h-4' />
          Recent Mixes
        </h3>
        <p className='text-sm text-muted-foreground'>Loading...</p>
      </div>
    )
  }

  const recentMixes = mixes.slice(0, 6)

  return (
    <div>
      <div className='flex items-center justify-between mb-3'>
        <h3 className='flex items-center gap-2 text-sm font-medium text-muted-foreground'>
          <Music className='w-4 h-4' />
          Recent Mixes
        </h3>
        <Link
          to='/mixes'
          className='text-xs text-muted-foreground hover:text-foreground'>
          View all
        </Link>
      </div>
      <div className='grid gap-8 sm:grid-cols-2 lg:grid-cols-3'>
        {recentMixes.map((mix) => (
          <div
            key={mix.id}
            className='flex flex-col gap-4 p-4 rounded-none border border-border bg-card/30 hover:bg-accent transition-all duration-300 group'>
            <div className='relative aspect-square w-full overflow-hidden rounded-none border border-border'>
              <img
                src={mix.thumbnailUrl || DEFAULT_IMAGE_URL}
                alt={mix.title}
                className='w-full h-full object-cover grayscale-[0.5] group-hover:grayscale-0 transition-all duration-500'
              />
              <div className='absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity'>
                <PlayPauseButton
                  url={mix.url}
                  thumbnailUrl={mix.thumbnailUrl || ''}
                  title={mix.title}
                  trackId={mix.id}
                />
              </div>
            </div>
            <div className='space-y-2'>
              <Link
                to='/mixes/$mixId'
                params={{ mixId: mix.slug }}
                className='text-sm font-bold uppercase tracking-widest truncate block hover:text-primary transition-colors'>
                {mix.title}
              </Link>
              {mix.description && (
                <p className='text-xs text-muted-foreground line-clamp-2 leading-relaxed'>
                  {mix.description}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
