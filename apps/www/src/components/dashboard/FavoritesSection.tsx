import { Link } from '@tanstack/react-router'
import { Heart } from 'lucide-react'
import { DEFAULT_IMAGE_URL } from '@/lib/constants'
import type { Favorite } from '@/lib/http'
import { useFavorites } from '@/lib/http'
import { PlayPauseButton } from '../PlayPauseButton'

type AudioFavorite = Favorite & { audio: NonNullable<Favorite['audio']> }

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

  const audioFavorites = favorites.filter(
    (f): f is AudioFavorite => f.audio !== null
  )

  if (audioFavorites.length === 0) {
    return null
  }

  return (
    <div className='flex flex-col h-full bg-card/15 rounded-sm overflow-hidden p-5 sm:p-6'>
      <h3 className='flex items-center gap-2 text-xs font-bold text-foreground uppercase tracking-widest mb-6'>
        <Heart className='w-3.5 h-3.5 text-red-500' />
        Favorites
      </h3>
      <div className='space-y-3'>
        {audioFavorites.slice(0, 6).map((favorite) => (
          <div
            key={favorite.id}
            className='flex items-center gap-4 p-2 rounded-sm hover:bg-muted/40 transition-all duration-300 group'>
            <div className='relative flex-shrink-0'>
              <img
                src={favorite.audio.thumbnailUrl || DEFAULT_IMAGE_URL}
                alt={favorite.audio.title}
                className='w-12 h-12 rounded-sm object-cover border border-border/50'
              />
              <div className='absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity'>
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
                  className='text-sm font-bold uppercase tracking-tight truncate block no-underline hover:text-primary transition-colors'>
                  {favorite.audio.title}
                </Link>
              ) : favorite.audio.type === 'track' ? (
                <Link
                  to='/tracks/$trackId'
                  params={{ trackId: favorite.audio.slug }}
                  className='text-sm font-bold uppercase tracking-tight truncate block no-underline hover:text-primary transition-colors'>
                  {favorite.audio.title}
                </Link>
              ) : (
                <span className='text-sm font-bold uppercase tracking-tight truncate block'>
                  {favorite.audio.title}
                </span>
              )}
              <p className='text-[9px] font-bold uppercase tracking-widest text-muted-foreground mt-1'>
                {favorite.audio.type}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
