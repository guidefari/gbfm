import { getMixRecencyLabel } from '@gbfm/core/utils'
import { Badge } from '@gbfm/ui'
import type { SelectAudio } from '@gbfm/vps/schemas'
import { Link } from '@tanstack/react-router'
import { Pause, Play } from 'lucide-react'
import { DEFAULT_IMAGE_URL } from '@/lib/constants'
import { cn } from '@/lib/utils'
import { useNowPlayingTrack, usePlayerActions, useTransport } from '@/services/player'
import { toQueueTrack } from '@/services/player/toQueueTrack'

interface MixListItemProps {
  mix: SelectAudio
  actions?: React.ReactNode
}

export function MixListItem({ mix, actions }: MixListItemProps) {
  const current = useNowPlayingTrack()
  const { isPlaying } = useTransport()
  const { playTrack, togglePlayPause } = usePlayerActions()

  const isActive = current?.id === mix.id
  const recencyLabel = getMixRecencyLabel(mix.createdAt)
  const hasCreators = Boolean(mix.creators && mix.creators.length > 0)

  const handlePlay = () => {
    if (isActive) togglePlayPause()
    else playTrack(toQueueTrack(mix))
  }

  return (
    <article
      data-testid='mix-item'
      className={cn(
        'group relative min-w-0 border border-border bg-card p-3 transition-colors hover:border-foreground/50 sm:p-4 lg:p-6',
        isActive && 'ring-1 ring-highlight bg-secondary'
      )}>
      <div className='grid min-w-0 grid-cols-[5.5rem_minmax(0,1fr)] gap-3 sm:grid-cols-[7rem_minmax(0,1fr)] sm:gap-4 lg:flex lg:flex-row lg:gap-6'>
        <div className='min-w-0 lg:flex-1'>
          <div className='flex min-w-0 justify-between items-start'>
            <Link
              to='/mixes/$mixId'
              params={{ mixId: mix.slug }}
              className='block min-w-0 text-base font-black leading-tight line-clamp-2 wrap-break-word text-foreground tracking-tight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:text-lg lg:text-2xl'>
              {mix.title}
            </Link>
            <div className='shrink-0 ml-2'>{actions}</div>
          </div>

          {hasCreators && (
            <p className='mt-1 text-[10px] tracking-widest text-highlight/80 line-clamp-1 sm:text-xs'>
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

          {mix.description && (
            <p className='hidden mt-4 text-sm leading-relaxed text-foreground/50 border-l-2 border-highlight/20 pl-4 py-1 italic line-clamp-2 lg:block'>
              {mix.description}
            </p>
          )}

          {mix.tags && mix.tags.length > 0 && (
            <div className='hidden flex-wrap items-center gap-1.5 mt-4 lg:flex'>
              {mix.tags.map((tag) => (
                <Link key={tag} to='/mixes' search={{ tag }}>
                  <Badge
                    variant='secondary'
                    className='rounded-none border border-border bg-muted/50 text-foreground/70 text-[10px] tracking-widest px-2 py-0.5 hover:border-highlight hover:text-highlight transition-colors cursor-pointer'>
                    {tag}
                  </Badge>
                </Link>
              ))}
            </div>
          )}

          <div className='mt-3 pt-3 border-t border-border/50 flex min-w-0 items-center gap-3 lg:mt-5 lg:pt-4 lg:gap-5'>
            <PlayButton
              isActive={isActive}
              isPlaying={isPlaying}
              title={mix.title}
              onClick={handlePlay}
            />
            {hasCreators && (
              <span className='hidden min-w-0 text-xs text-muted-foreground font-bold tracking-widest line-clamp-1 lg:block'>
                By {mix.creators?.map((c) => c.name).join(' & ')}
              </span>
            )}
          </div>
        </div>

        <div className='relative shrink-0 order-first lg:order-last'>
          <img
            src={mix.thumbnailUrl || DEFAULT_IMAGE_URL}
            alt={`Artwork for ${mix.title}`}
            width={192}
            height={192}
            loading='lazy'
            sizes='(max-width: 639px) 88px, (max-width: 1023px) 112px, 192px'
            className='object-cover border w-[5.5rem] aspect-square sm:w-28 lg:w-48 border-border bg-background'
          />
          {recencyLabel && (
            <span
              className={cn(
                'absolute right-2 top-2 border px-2 py-1 text-[10px] font-bold tracking-widest leading-none',
                recencyLabel === 'new'
                  ? 'border-highlight bg-highlight text-highlight-foreground'
                  : 'border-border bg-background/90 text-foreground/75 backdrop-blur-sm'
              )}>
              {recencyLabel}
            </span>
          )}
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
  const playLabel = title.split(' ')[0]

  return (
    <button
      type='button'
      onClick={onClick}
      className={cn(
        'flex min-h-11 min-w-11 items-center justify-center gap-2 px-3 py-2 text-sm font-bold border-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:px-5',
        isActive && isPlaying
          ? 'bg-highlight text-highlight-foreground border-highlight'
          : 'border-border text-foreground/80 hover:border-highlight hover:text-highlight'
      )}>
      {isActive && isPlaying ? (
        <Pause size={14} fill='currentColor' />
      ) : (
        <Play size={14} fill='currentColor' />
      )}
      <span className='hidden sm:inline'>
        {isActive && isPlaying ? 'playing' : `play ${playLabel}`}
      </span>
      <span className='sm:hidden'>{isActive && isPlaying ? 'pause' : 'play'}</span>
    </button>
  )
}
