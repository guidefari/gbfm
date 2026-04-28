import { Link } from '@tanstack/react-router'
import { Pause, Play, SkipBack, SkipForward } from 'lucide-react'
import { OverflowTitle } from '@/components/player/OverflowTitle'
import { cn } from '@/lib/utils'
import { useAudioPlayerActions, useAudioPlayerState } from '@/store/audioPlayer'

type NowPlayingMiniProps = {
  onClose?: () => void
}

export function NowPlayingMini({ onClose }: NowPlayingMiniProps) {
  const { thumbnailUrl, nowPlayingContext, isPlaying } = useAudioPlayerState()
  const { togglePlayPause, playNext, playPrevious, toggleFullscreen } =
    useAudioPlayerActions()

  const title = nowPlayingContext?.title || 'Unknown Track'

  const handleOpenFullscreen = () => {
    onClose?.()
    toggleFullscreen()
  }

  const creators = nowPlayingContext?.creators ?? []

  return (
    <div
      className={cn(
        'mx-auto w-full max-w-full overflow-hidden rounded-sm border border-border bg-card p-3 shadow-xl',
        'sm:max-w-md'
      )}>
      <div className='flex items-start gap-3'>
        <button
          type='button'
          onClick={handleOpenFullscreen}
          className='relative h-14 w-14 shrink-0 overflow-hidden rounded-sm border border-border bg-muted focus:outline-none focus:ring-2 focus:ring-ring'>
          {thumbnailUrl ? (
            <img
              src={thumbnailUrl}
              alt={title}
              className='h-full w-full object-cover'
            />
          ) : (
            <div className='flex h-full w-full items-center justify-center bg-muted'>
              <Play className='h-6 w-6 text-muted-foreground' />
            </div>
          )}
        </button>

        <div className='min-w-0 flex-1'>
          <button
            type='button'
            onClick={handleOpenFullscreen}
            className='block w-full text-left focus:outline-none'>
            <OverflowTitle
              text={title}
              textClassName='text-sm font-semibold text-foreground'
            />
            <div className='mt-0.5 truncate text-xs text-muted-foreground'>
              {creators.length > 0 ? (
                creators.map((creator, index) => (
                  <span key={creator.id}>
                    {creator.username ? (
                      <Link
                        to='/profile/$username'
                        params={{ username: creator.username }}
                        className='hover:text-foreground hover:underline'
                        onClick={(e) => e.stopPropagation()}>
                        {creator.name}
                      </Link>
                    ) : (
                      <span>{creator.name}</span>
                    )}
                    {index < creators.length - 1 && ', '}
                  </span>
                ))
              ) : (
                <span>Unknown creator</span>
              )}
            </div>
          </button>

          <div className='mt-1.5 flex items-center gap-1'>
            <button
              type='button'
              onClick={playPrevious}
              className={cn(
                'flex h-10 w-10 items-center justify-center rounded-sm transition-colors',
                'hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring'
              )}
              aria-label='Previous track'>
              <SkipBack className='h-4 w-4' />
            </button>

            <button
              type='button'
              onClick={togglePlayPause}
              className={cn(
                'flex h-10 w-10 items-center justify-center rounded-sm transition-colors',
                'hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring'
              )}
              aria-label={isPlaying ? 'Pause' : 'Play'}>
              {isPlaying ? (
                <Pause className='h-4 w-4' />
              ) : (
                <Play className='h-4 w-4' />
              )}
            </button>

            <button
              type='button'
              onClick={playNext}
              className={cn(
                'flex h-10 w-10 items-center justify-center rounded-sm transition-colors',
                'hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring'
              )}
              aria-label='Next track'>
              <SkipForward className='h-4 w-4' />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
