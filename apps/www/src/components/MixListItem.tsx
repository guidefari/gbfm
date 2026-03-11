import { getMixRecencyLabel } from '@gbfm/core/utils'
import type { SelectAudio } from '@gbfm/vps/schemas'
import { Link } from '@tanstack/react-router'
import { CalendarDays, Pause, Play } from 'lucide-react'
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

  const handlePlay = () =>
    loadTrack(
      mix.url,
      mix.thumbnailUrl || DEFAULT_IMAGE_URL,
      mix.title,
      mix.id,
      mix.creators,
      mix.slug
    )

  return (
    <article
      data-testid='mix-item'
      className={cn(
        'group relative border border-border bg-card p-4 sm:p-5 transition-all duration-200 hover:border-foreground/50 hover:shadow-sm',
        isActive && 'ring-1 ring-highlight bg-secondary'
      )}>
      <div className='flex flex-col sm:flex-row gap-4 sm:gap-5'>
        <div className='relative flex-shrink-0'>
          <img
            src={mix.thumbnailUrl || DEFAULT_IMAGE_URL}
            alt={mix.title}
            className='object-cover border w-full sm:w-32 h-32 border-border bg-background'
          />
          {recencyLabel && (
            <span
              className={cn(
                'absolute -top-2 -right-2 text-[10px] font-bold px-2 py-0.5',
                recencyLabel === 'new'
                  ? 'bg-highlight text-background'
                  : 'bg-foreground/20 text-foreground/70'
              )}>
              {recencyLabel.toUpperCase()}
            </span>
          )}
        </div>

        <div className='flex-1 min-w-0 flex flex-col justify-between'>
          <div>
            <div className='flex justify-between items-start'>
              <div className='space-y-1'>
                <Link
                  to='/mixes/$mixId'
                  params={{ mixId: mix.slug }}
                  className='block text-lg sm:text-xl font-bold leading-tight line-clamp-2 text-foreground group-hover:text-highlight transition-colors'>
                  {mix.title}
                </Link>
                {hasCreators && (
                  <p className='text-xs uppercase tracking-widest text-highlight/80'>
                    <span className='opacity-60'>By </span>
                    {mix.creators?.map((creator, index) => (
                      <span key={creator.id}>
                        {creator.username ? (
                          <Link
                            to='/profile/$username'
                            params={{ username: creator.username }}
                            className='hover:underline decoration-highlight/50 underline-offset-4'>
                            {creator.name}
                          </Link>
                        ) : (
                          <span>{creator.name}</span>
                        )}
                        {index < (mix.creators?.length || 0) - 1 && (
                          <span className='mx-1 opacity-50'>&</span>
                        )}
                      </span>
                    ))}
                  </p>
                )}
              </div>
              <div className='flex-shrink-0 ml-2'>{actions}</div>
            </div>

            {mix.tags && mix.tags.length > 0 && (
              <div className='flex flex-wrap items-center gap-1.5 mt-3'>
                {mix.tags.map((tag) => (
                  <Link key={tag} to='/mixes' search={{ tag }}>
                    <Badge
                      variant='secondary'
                      className='rounded-none border border-border bg-muted/50 text-foreground/70 text-[10px] uppercase tracking-widest px-2 py-0.5 hover:border-highlight hover:text-highlight transition-colors cursor-pointer'>
                      {tag}
                    </Badge>
                  </Link>
                ))}
              </div>
            )}

            {mix.description && (
              <p className='mt-3 text-sm leading-relaxed text-foreground/60 line-clamp-2'>
                {mix.description}
              </p>
            )}
          </div>

          <div className='mt-4 pt-3 border-t border-border/50 flex items-center justify-between'>
            <PlayButton
              isActive={isActive}
              isPlaying={isPlaying}
              title={mix.title}
              onClick={handlePlay}
            />
            <span className='flex items-center gap-1.5 text-[11px] font-mono text-muted-foreground'>
              <CalendarDays className='w-3.5 h-3.5 opacity-50' />
              {new Date(mix.createdAt)
                .toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric'
                })
                .toUpperCase()}
            </span>
          </div>
        </div>
      </div>
    </article>
  )
}

function PlayButton({
  isActive,
  isPlaying,
  title,
  onClick
}: {
  isActive: boolean
  isPlaying: boolean
  title: string
  onClick: () => void
}) {
  const playLabel = title.split(' ')[0].toUpperCase()

  return (
    <button
      type='button'
      onClick={onClick}
      className={cn(
        'flex items-center gap-2 px-5 py-2 text-sm font-bold border-2 transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        isActive && isPlaying
          ? 'bg-highlight text-background border-highlight'
          : 'border-border text-foreground/80 hover:border-highlight hover:text-highlight'
      )}>
      {isActive && isPlaying ? (
        <Pause size={14} fill='currentColor' />
      ) : (
        <Play size={14} fill='currentColor' />
      )}
      <span>{isActive && isPlaying ? 'PLAYING' : `PLAY ${playLabel}`}</span>
    </button>
  )
}
