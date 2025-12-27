import { Pause, Play, SkipBack, SkipForward } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAudioPlayerActions, useAudioPlayerState } from '@/store/audioPlayer'

type NowPlayingMiniProps = {
  onClose?: () => void
}

export function NowPlayingMini({ onClose }: NowPlayingMiniProps) {
  const { thumbnailUrl, nowPlayingContext, isPlaying } = useAudioPlayerState()
  const { togglePlayPause, playNext, playPrevious, toggleFullscreen } =
    useAudioPlayerActions()

  const handleOpenFullscreen = () => {
    onClose?.()
    toggleFullscreen()
  }

  return (
    <div
      className={cn(
        'flex items-center gap-3 p-3 rounded-sm',
        'bg-card border border-border shadow-xl',
        'min-w-[280px]'
      )}>
      <button
        type='button'
        onClick={handleOpenFullscreen}
        className='relative flex-shrink-0 overflow-hidden rounded-sm focus:outline-none focus:ring-2 focus:ring-ring'>
        {thumbnailUrl ? (
          <img
            src={thumbnailUrl}
            alt={nowPlayingContext?.title || 'Now playing'}
            className='object-cover w-14 h-14'
          />
        ) : (
          <div className='flex items-center justify-center w-14 h-14 bg-muted'>
            <Play className='w-6 h-6 text-muted-foreground' />
          </div>
        )}
      </button>

      <div className='flex-1 min-w-0'>
        <button
          type='button'
          onClick={handleOpenFullscreen}
          className='block w-full text-left focus:outline-none'>
          <p className='text-sm font-medium truncate text-foreground'>
            {nowPlayingContext?.title || 'Unknown Track'}
          </p>
          <p className='text-xs truncate text-muted-foreground'>Now Playing</p>
        </button>
      </div>

      <div className='flex items-center gap-1'>
        <button
          type='button'
          onClick={playPrevious}
          className={cn(
            'p-2 rounded-sm transition-colors',
            'hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring'
          )}
          aria-label='Previous track'>
          <SkipBack className='w-4 h-4' />
        </button>

        <button
          type='button'
          onClick={togglePlayPause}
          className={cn(
            'p-2 rounded-sm transition-colors',
            'bg-primary text-primary-foreground',
            'hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring'
          )}
          aria-label={isPlaying ? 'Pause' : 'Play'}>
          {isPlaying ? (
            <Pause className='w-4 h-4' />
          ) : (
            <Play className='w-4 h-4' />
          )}
        </button>

        <button
          type='button'
          onClick={playNext}
          className={cn(
            'p-2 rounded-sm transition-colors',
            'hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring'
          )}
          aria-label='Next track'>
          <SkipForward className='w-4 h-4' />
        </button>
      </div>
    </div>
  )
}
