import type { SelectAudio } from '@gbfm/vps/schemas'
import { Link } from '@tanstack/react-router'
import { GiPauseButton, GiPlayButton } from 'react-icons/gi'
import { DEFAULT_IMAGE_URL } from '@/lib/constants'
import { cn } from '@/lib/utils'
import { useAudioPlayerActions, useAudioPlayerState } from '@/store/audioPlayer'

interface MixListItemProps {
  mix: SelectAudio
  actions?: React.ReactNode
}

export function MixListItem({ mix, actions }: MixListItemProps) {
  const { isPlaying, nowPlayingContext } = useAudioPlayerState()
  const { loadTrack } = useAudioPlayerActions()

  const isActive = nowPlayingContext?.title === mix.title

  return (
    <article
      className={cn(
        'flex gap-3 items-start p-2 transition-all duration-300 hover:bg-muted/50 rounded-sm group',
        isActive && 'ring-1 ring-border bg-accent/5 shadow-sm'
      )}>
      <button
        type='button'
        className='relative flex-shrink-0 focus:outline-none'
        onClick={() =>
          loadTrack(
            mix.url,
            mix.thumbnailUrl || DEFAULT_IMAGE_URL,
            mix.title,
            mix.id,
            mix.creators,
            mix.slug
          )
        }>
        <img
          src={mix.thumbnailUrl || DEFAULT_IMAGE_URL}
          alt={mix.title}
          className='object-cover transition-transform duration-300 border rounded-sm w-14 h-14 border-border bg-background group-hover:scale-105'
        />
        <span
          className={cn(
            'absolute inset-0 flex items-center justify-center transition-all duration-300 rounded-sm bg-black/50',
            isActive
              ? 'opacity-100'
              : 'opacity-0 group-hover:opacity-100 group-focus:opacity-100'
          )}>
          {isActive && isPlaying ? (
            <GiPauseButton className='text-2xl text-white drop-shadow' />
          ) : (
            <GiPlayButton className='text-2xl text-white drop-shadow' />
          )}
        </span>
      </button>
      <div className='flex-1 min-w-0'>
        <div className='flex items-start justify-between gap-2'>
          <Link
            to='/mixes/$mixId'
            params={{ mixId: mix.slug }}
            className='flex-1 block font-bold leading-tight line-clamp-2 text-foreground hover:underline decoration-foreground/30 underline-offset-4'>
            {mix.title}
          </Link>
          {actions}
        </div>
        {mix.description && (
          <div className='mt-1 text-sm leading-relaxed text-foreground/60 line-clamp-2'>
            {mix.description}
          </div>
        )}
      </div>
    </article>
  )
}
