import { Link } from '@tanstack/react-router'
import { Music } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DEFAULT_IMAGE_URL } from '@/lib/constants'
import { useAudioByType } from '@/lib/http'
import { PlayPauseButton } from '../PlayPauseButton'

export function RecentMixesSection() {
  const { data: mixes, isPending } = useAudioByType('mix')

  if (isPending) {
    return (
      <Card>
        <CardHeader className='pb-3'>
          <CardTitle className='flex items-center gap-2 text-lg'>
            <Music className='w-5 h-5' />
            Recent Mixes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className='text-sm text-muted-foreground'>Loading...</div>
        </CardContent>
      </Card>
    )
  }

  const recentMixes = mixes.slice(0, 6)

  return (
    <Card>
      <CardHeader className='pb-3'>
        <div className='flex items-center justify-between'>
          <CardTitle className='flex items-center gap-2 text-lg'>
            <Music className='w-5 h-5' />
            Recent Mixes
          </CardTitle>
          <Link
            to='/mixes'
            className='text-sm text-muted-foreground hover:text-foreground'>
            View all
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        <div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-3'>
          {recentMixes.map((mix) => (
            <div
              key={mix.id}
              className='flex items-center gap-3 p-2 rounded-md hover:bg-accent/50 transition-colors'>
              <div className='relative flex-shrink-0'>
                <img
                  src={mix.thumbnailUrl || DEFAULT_IMAGE_URL}
                  alt={mix.title}
                  className='w-12 h-12 rounded object-cover'
                />
                <div className='absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 hover:opacity-100 transition-opacity rounded'>
                  <PlayPauseButton
                    url={mix.url}
                    thumbnailUrl={mix.thumbnailUrl || ''}
                    title={mix.title}
                  />
                </div>
              </div>
              <div className='flex-1 min-w-0'>
                <Link
                  to='/mixes/$mixId'
                  params={{ mixId: mix.slug }}
                  className='font-medium text-sm truncate block hover:underline'>
                  {mix.title}
                </Link>
                {mix.description && (
                  <p className='text-xs text-muted-foreground truncate'>
                    {mix.description}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
