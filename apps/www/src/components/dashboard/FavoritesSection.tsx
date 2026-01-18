import { Link } from '@tanstack/react-router'
import { Heart } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DEFAULT_IMAGE_URL } from '@/lib/constants'
import { useFavorites } from '@/lib/http'
import { PlayPauseButton } from '../PlayPauseButton'

export function FavoritesSection() {
  const { data: favorites, isPending } = useFavorites()

  if (isPending) {
    return (
      <Card>
        <CardHeader className='pb-3'>
          <CardTitle className='flex items-center gap-2 text-lg'>
            <Heart className='w-5 h-5' />
            Favorites
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className='text-sm text-muted-foreground'>Loading...</div>
        </CardContent>
      </Card>
    )
  }

  if (favorites.length === 0) {
    return null
  }

  return (
    <Card>
      <CardHeader className='pb-3'>
        <CardTitle className='flex items-center gap-2 text-lg'>
          <Heart className='w-5 h-5' />
          Favorites
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-3'>
          {favorites.slice(0, 6).map((favorite) => (
            <div
              key={favorite.id}
              className='flex items-center gap-3 p-2 rounded-md hover:bg-accent/50 transition-colors'>
              <div className='relative flex-shrink-0'>
                <img
                  src={favorite.audio.thumbnailUrl || DEFAULT_IMAGE_URL}
                  alt={favorite.audio.title}
                  className='w-12 h-12 rounded object-cover'
                />
                <div className='absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 hover:opacity-100 transition-opacity rounded'>
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
                    className='font-medium text-sm truncate block hover:underline'>
                    {favorite.audio.title}
                  </Link>
                ) : favorite.audio.type === 'track' ? (
                  <Link
                    to='/tracks/$trackId'
                    params={{ trackId: favorite.audio.slug }}
                    className='font-medium text-sm truncate block hover:underline'>
                    {favorite.audio.title}
                  </Link>
                ) : (
                  <span className='font-medium text-sm truncate block'>
                    {favorite.audio.title}
                  </span>
                )}
                <p className='text-xs text-muted-foreground capitalize'>
                  {favorite.audio.type}
                </p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
