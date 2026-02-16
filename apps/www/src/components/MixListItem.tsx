import { getMixRecencyLabel } from '@gbfm/core/utils'
import type { SelectAudio } from '@gbfm/vps/schemas'
import { Link } from '@tanstack/react-router'
import { CalendarDays, Sparkles } from 'lucide-react'
import { GiPauseButton, GiPlayButton } from 'react-icons/gi'
import { Badge } from '@/components/ui/badge'
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
  const recencyLabel = getMixRecencyLabel(mix.createdAt)
  const hasCreators = Boolean(mix.creators && mix.creators.length > 0)

  return (
    <article
      data-testid='mix-item'
      className={cn(
        'group relative flex items-start gap-3 border border-border bg-card p-3 sm:p-4 transition-all duration-200 hover:bg-muted hover:border-foreground hover:shadow-sm',
        isActive && 'ring-1 ring-highlight bg-secondary hover:bg-muted'
      )}>
      <div className='absolute top-3 right-3 z-10 flex items-start'>
        {actions}
      </div>
      <button
        type='button'
        className='relative flex-shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background'
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
          className='object-cover transition-transform duration-300 border w-20 h-20 border-border bg-background group-hover:scale-101'
        />
        <span
          className={cn(
            'absolute inset-0 flex items-center justify-center transition-all duration-300 bg-black/50',
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
      <div className='flex-1 min-w-0 pr-24 sm:pr-28'>
        <div className='flex items-start justify-between gap-3'>
          <div className='flex-1 min-w-0 space-y-2'>
            <Link
              to='/mixes/$mixId'
              params={{ mixId: mix.slug }}
              className='block text-base sm:text-lg font-extrabold leading-tight line-clamp-2 text-foreground hover:underline decoration-foreground/30 underline-offset-4'>
              {mix.title}
            </Link>
            {hasCreators && (
              <p className='p-0 text-xs uppercase tracking-widest text-muted-foreground/90'>
                <span className='opacity-60'>By </span>
                {mix.creators?.map((creator, index) => (
                  <span key={creator.id}>
                    {creator.username ? (
                      <Link
                        to='/profile/$username'
                        params={{ username: creator.username }}
                        className='font-semibold text-foreground/90 hover:text-foreground hover:underline'>
                        {creator.name}
                      </Link>
                    ) : (
                      <span className='font-semibold text-foreground/90'>
                        {creator.name}
                      </span>
                    )}
                    {index < (mix.creators?.length || 0) - 1 && (
                      <span className='mx-1 opacity-50'>&</span>
                    )}
                  </span>
                ))}
              </p>
            )}
            {mix.description && (
              <p className='p-0 text-sm leading-relaxed text-foreground/70 line-clamp-2'>
                {mix.description}
              </p>
            )}
            {mix.tags && mix.tags.length > 0 && (
              <div className='flex flex-wrap items-center gap-1.5'>
                {mix.tags.map((tag) => (
                  <Badge
                    key={tag}
                    variant='secondary'
                    className='rounded-none border-none bg-muted/80 text-foreground/85 text-[10px] uppercase tracking-widest px-2 py-1'>
                    {tag}
                  </Badge>
                ))}
              </div>
            )}
            <div className='flex flex-wrap items-center gap-2'>
              <Badge
                variant='secondary'
                className='rounded-none border-none bg-muted/90 text-foreground/90 text-[10px] uppercase tracking-widest font-semibold px-2 py-1 gap-1.5'>
                <CalendarDays className='w-3.5 h-3.5' />
                {new Date(mix.createdAt).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric'
                })}
              </Badge>
              {recencyLabel && (
                <Badge
                  variant='secondary'
                  className={cn(
                    'rounded-none border-none text-[10px] uppercase tracking-widest font-bold gap-1 shadow-sm',
                    recencyLabel === 'new'
                      ? 'bg-highlight text-background'
                      : 'bg-foreground text-black'
                  )}>
                  <Sparkles className='w-3 h-3' />
                  {recencyLabel}
                </Badge>
              )}
            </div>
          </div>
        </div>
      </div>
    </article>
  )
}
