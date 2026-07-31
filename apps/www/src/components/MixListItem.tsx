import { getMixRecencyLabel } from '@gbfm/core/utils'
import { Badge, playbackStates, PlayToggle } from '@gbfm/ui'
import type { SelectAudio } from '@gbfm/vps/schemas'
import { Link } from '@tanstack/react-router'
import { Artwork } from '@/components/common/Artwork'
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
  const dateLabel = new Date(mix.createdAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })

  const handlePlay = () => {
    if (isActive) togglePlayPause()
    else playTrack(toQueueTrack(mix))
  }

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
              className='block text-2xl font-black leading-tight line-clamp-2 text-foreground tracking-tight transition-colors'>
              {mix.title}
            </Link>
            <div className='shrink-0 ml-2'>{actions}</div>
          </div>

          <div className='mt-1 flex flex-wrap items-center gap-x-2 gap-y-1'>
            <span className='text-[11px] font-mono tracking-widest text-muted-foreground'>
              {dateLabel}
            </span>
            {hasCreators && (
              <p className='text-xs tracking-widest text-highlight/80'>
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
                    className='rounded-none border border-border bg-muted/50 text-foreground/70 text-[10px] tracking-widest px-2 py-0.5 hover:border-highlight hover:text-highlight transition-colors cursor-pointer'>
                    {tag}
                  </Badge>
                </Link>
              ))}
            </div>
          )}

          <div className='mt-5 pt-4 border-t border-border/50 flex items-center gap-5'>
            <PlayToggle
              state={isActive && isPlaying ? playbackStates.playing : playbackStates.idle}
              variant='button'
              label={mix.title.split(' ')[0]}
              onToggle={handlePlay}
            />
          </div>
        </div>

        <Artwork
          src={mix.thumbnailUrl}
          alt={mix.title}
          aspect='auto'
          radius='none'
          className='shrink-0 order-first lg:order-last w-full lg:w-48 h-48'
          overlay={
            recencyLabel && (
              <span
                className={cn(
                  'absolute right-2 top-2 border px-2 py-1 text-[10px] font-bold tracking-widest leading-none',
                  recencyLabel === 'new'
                    ? 'border-highlight bg-highlight text-highlight-foreground'
                    : 'border-border bg-background/90 text-foreground/75 backdrop-blur-sm'
                )}>
                {recencyLabel}
              </span>
            )
          }
        />
      </div>
    </article>
  )
}
