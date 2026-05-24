import { getMixRecencyLabel } from '@gbfm/core/utils'
import { Badge } from '@gbfm/ui'
import type { SelectAudio } from '@gbfm/vps/schemas'
import { Link } from '@tanstack/react-router'
import { Pause, Play } from 'lucide-react'
import { DEFAULT_IMAGE_URL } from '@/lib/constants'
import { cn } from '@/lib/utils'
import {
  useAudioPlayerActions,
  useAudioPlayerPlaybackState
} from '@/store/audioPlayer'

interface MixListItemProps {
  mix: SelectAudio
  actions?: React.ReactNode
}

export function MixListItem({ mix, actions }: MixListItemProps) {
  const { isPlaying, nowPlayingContext } = useAudioPlayerPlaybackState()
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
        'group relative border border-border bg-card p-5 sm:p-6 transition-all duration-200 hover:border-foreground/50',
        isActive && 'ring-1 ring-highlight bg-secondary'
      )}>
      <div className='flex flex-col lg:flex-row gap-6'>
        <div className='flex-1 min-w-0'>
          <div className='flex justify-between items-start'>
            <Link
              to='/mixes/$mixId'
              params={{ mixId: mix.slug }}
              className='block text-2xl font-black leading-tight line-clamp-2 text-foreground uppercase tracking-tight transition-colors'>
              {mix.title}
            </Link>
            <div className='shrink-0 ml-2'>{actions}</div>
          </div>

          {hasCreators && (
            <p className='mt-1 text-xs uppercase tracking-widest text-highlight/80'>
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
            <p className='mt-4 text-sm leading-relaxed text-foreground/50 border-l-2 border-highlight/20 pl-4 py-1 italic line-clamp-2'>
              {mix.description}
            </p>
          )}

          {mix.tags && mix.tags.length > 0 && (
            <div className='flex flex-wrap items-center gap-1.5 mt-4'>
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

          <div className='mt-5 pt-4 border-t border-border/50 flex items-center gap-5'>
            <PlayButton
              isActive={isActive}
              isPlaying={isPlaying}
              title={mix.title}
              onClick={handlePlay}
            />
            {hasCreators && (
              <span className='text-xs text-muted-foreground uppercase font-bold tracking-widest'>
                By {mix.creators?.map((c) => c.name).join(' & ')}
              </span>
            )}
          </div>
        </div>

        <div className='relative shrink-0 order-first lg:order-last'>
          <img
            src={mix.thumbnailUrl || DEFAULT_IMAGE_URL}
            alt={mix.title}
            className='object-cover border w-full lg:w-48 h-48 border-border bg-background'
          />
          {recencyLabel && (
            <span
              className={cn(
                'absolute right-2 top-2 border px-2 py-1 text-[10px] font-bold uppercase tracking-widest leading-none',
                recencyLabel === 'new'
                  ? 'border-highlight bg-highlight text-background'
                  : 'border-border bg-background/90 text-foreground/75 backdrop-blur-sm'
              )}>
              {recencyLabel.toUpperCase()}
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
