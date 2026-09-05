import { Music4 } from 'lucide-react'
import { Artwork } from '@/components/common/Artwork'
import { StreamLinks } from '@/components/StreamLinks'
import { entityLabelByType, useMusicEntity } from '@/components/tweet-export/use-music-entity'
import { useSession } from '@/lib/auth-client'
import { MusicEntityTracks } from './MusicEntityTracks'
import { RemindMeButton } from './RemindMeButton'

export interface MusicEntityDisplayProps {
  readonly showTracks?: boolean
  readonly showPlaybackControls?: boolean
  readonly showReminder?: boolean
}

export interface MusicEntityCardProps extends MusicEntityDisplayProps {
  readonly type: string
  readonly id: string
}

export function MusicEntityCard({
  type,
  id,
  showTracks = true,
  showPlaybackControls = true,
  showReminder = true
}: MusicEntityCardProps) {
  const { entity, entityType, isPending, isLinksPending, verifiedLinks } = useMusicEntity(type, id)
  const { data: session } = useSession()

  if (!entityType || !id) {
    return (
      <p role='alert' className='not-prose text-sm text-destructive'>
        This music embed is invalid.
      </p>
    )
  }

  if (isPending) {
    return (
      <div
        role='status'
        aria-label='Loading music entity'
        className='not-prose flex animate-pulse gap-4 rounded-md border border-border/50 bg-muted/20 p-4'>
        <div className='size-24 shrink-0 rounded-sm bg-muted sm:size-32' />
        <div className='flex-1 space-y-3 py-2'>
          <div className='h-3 w-16 rounded bg-muted' />
          <div className='h-5 w-2/3 rounded bg-muted' />
          <div className='h-3 w-1/3 rounded bg-muted' />
        </div>
      </div>
    )
  }

  if (!entity) {
    return (
      <p role='alert' className='not-prose text-sm text-muted-foreground'>
        This music entity is unavailable.
      </p>
    )
  }

  const spotifyUrl = verifiedLinks.find((link) => link.platform === 'spotify')?.url
  const musicUrl = spotifyUrl ?? verifiedLinks[0]?.url ?? null

  return (
    <article className='not-prose min-w-0 overflow-hidden rounded-md border border-border/50 bg-muted/20'>
      <div className='flex items-start gap-4 p-4 sm:gap-5'>
        <div className='flex size-24 shrink-0 items-center justify-center overflow-hidden rounded-sm bg-muted sm:size-32'>
          {entity.coverImageUrl ? (
            <Artwork
              src={entity.coverImageUrl}
              alt={entity.title}
              width={128}
              height={128}
              sizes='(min-width: 640px) 128px, 96px'
              className='size-full object-cover'
            />
          ) : (
            <Music4 className='size-10 text-muted-foreground/70' aria-hidden='true' />
          )}
        </div>
        <div className='min-w-0 flex-1 space-y-2'>
          <p className='text-[10px] font-bold uppercase tracking-[0.3em] text-muted-foreground/70'>
            {entityLabelByType[entityType]}
          </p>
          <h2 className='break-words text-lg font-bold leading-snug tracking-tight text-foreground sm:text-xl'>
            {entity.title}
          </h2>
          {entity.artistNames?.length ? (
            <p className='text-sm text-muted-foreground'>{entity.artistNames.join(', ')}</p>
          ) : null}
        </div>
      </div>
      {entity.description ? (
        <p className='px-4 pb-4 text-sm leading-relaxed text-muted-foreground'>
          {entity.description}
        </p>
      ) : null}
      {verifiedLinks.length > 0 || (showReminder && session?.user && musicUrl) ? (
        <div className='flex flex-wrap items-center gap-2 border-t border-border/40 px-4 py-3'>
          <StreamLinks links={verifiedLinks} showPlaybackControls={showPlaybackControls} />
          {showReminder && session?.user && musicUrl ? (
            <RemindMeButton
              title={entity.title}
              artistNames={entity.artistNames}
              coverImageUrl={entity.coverImageUrl}
              musicUrl={musicUrl}
            />
          ) : null}
        </div>
      ) : null}
      {showTracks && entityType !== 'track' && !isLinksPending ? (
        <MusicEntityTracks
          type={entityType}
          id={id}
          spotifyUrl={spotifyUrl}
          showPlaybackControls={showPlaybackControls}
        />
      ) : null}
    </article>
  )
}
