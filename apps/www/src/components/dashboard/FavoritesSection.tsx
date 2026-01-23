import { Link } from '@tanstack/react-router'
import { Heart } from 'lucide-react'
import { DEFAULT_IMAGE_URL } from '@/lib/constants'
import { useFavorites } from '@/lib/http'
import { PlayPauseButton } from '../PlayPauseButton'

export function FavoritesSection() {
  const { data: favorites, isPending } = useFavorites()

  if (isPending) {
    return (
      <div>
        <h3 className='flex items-center gap-2 text-sm font-medium text-muted-foreground mb-3'>
          <Heart className='w-4 h-4' />
          Favorites
        </h3>
        <p className='text-sm text-muted-foreground'>Loading...</p>
      </div>
    )
  }

  if (favorites.length === 0) {
    return null
  }

  return (
    <div className='flex flex-col h-full bg-card/30 rounded-xl border border-border overflow-hidden p-4'>
      <h3 className='flex items-center gap-2 text-sm font-semibold text-foreground uppercase tracking-wider mb-4'>
        <Heart className='w-4 h-4 text-red-500' />
        Favorites
      </h3>
      <div className='space-y-2'>
        {favorites.slice(0, 6).map((favorite) => (
          <div
            key={favorite.id}
            className='flex items-center gap-3 p-2 rounded-lg hover:bg-accent/50 transition-all duration-200 group border border-transparent hover:border-border'>
            <div className='relative flex-shrink-0'>
              <img
                src={favorite.audio.thumbnailUrl || DEFAULT_IMAGE_URL}
                alt={favorite.audio.title}
                className='w-10 h-10 rounded-md object-cover ring-1 ring-border'
              />
              <div className='absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-md'>
                <PlayPauseButton
                  url={favorite.audio.url}
                  thumbnailUrl={favorite.audio.thumbnailUrl || ''}
                  title={favorite.audio.title}
                  trackId={favorite.audio.id}
                />
              </div>
            </div>
            <div className='flex-1 min-w-0'>
              {favorite.audio.type === 'mix' ? (
                <Link
                  to='/mixes/$mixId'
                  params={{ mixId: favorite.audio.slug }}
                  className='text-sm font-medium truncate block hover:text-primary transition-colors'>
                  {favorite.audio.title}
                </Link>
              ) : favorite.audio.type === 'track' ? (
                <Link
                  to='/tracks/$trackId'
                  params={{ trackId: favorite.audio.slug }}
                  className='text-sm font-medium truncate block hover:text-primary transition-colors'>
                  {favorite.audio.title}
                </Link>
              ) : (
                <span className='text-sm font-medium truncate block'>
                  {favorite.audio.title}
                </span>
              )}
              <p className='text-[10px] text-muted-foreground uppercase tracking-tighter'>
                {favorite.audio.type}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
