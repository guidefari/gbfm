import { Music4 } from 'lucide-react'
import { Artwork } from '@/components/common/Artwork'
import { entityLabelByType, useMusicEntity } from '@/components/tweet-export/use-music-entity'

export interface MusicEntityProps {
  readonly type: string
  readonly id: string
}

export function MusicEntity({ type, id }: MusicEntityProps) {
  const { entity, entityType, isPending } = useMusicEntity(type, id)

  if (!entityType || !id) {
    return (
      <p role='alert' className='not-prose my-6 text-sm text-destructive'>
        This music embed is invalid.
      </p>
    )
  }

  if (isPending) {
    return (
      <div
        role='status'
        aria-label='Loading music entity'
        className='not-prose my-6 animate-pulse overflow-hidden rounded-md border border-border/50 bg-muted/20 sm:flex'>
        <div className='aspect-square w-full bg-muted sm:h-40 sm:w-40 sm:shrink-0' />
        <div className='space-y-2 p-4'>
          <div className='h-2.5 w-16 rounded-full bg-muted' />
          <div className='h-4 w-2/3 rounded-full bg-muted' />
          <div className='h-3 w-1/3 rounded-full bg-muted' />
        </div>
      </div>
    )
  }

  if (!entity) {
    return (
      <p role='alert' className='not-prose my-6 text-sm text-muted-foreground'>
        This music entity is unavailable.
      </p>
    )
  }

  return (
    <article className='not-prose my-6 overflow-hidden rounded-md border border-border/50 bg-muted/20 sm:flex'>
      <div className='flex aspect-square w-full shrink-0 items-center justify-center overflow-hidden bg-muted sm:h-auto sm:w-40'>
        {entity.coverImageUrl ? (
          <Artwork
            src={entity.coverImageUrl}
            alt={entity.title}
            width={160}
            height={160}
            sizes='(min-width: 640px) 160px, 100vw'
            className='size-full object-cover'
          />
        ) : (
          <Music4 className='size-12 text-muted-foreground/70' aria-hidden='true' />
        )}
      </div>
      <div className='min-w-0 p-4'>
        <p className='text-[10px] font-bold uppercase tracking-[0.3em] text-muted-foreground/60'>
          {entityLabelByType[entityType]}
        </p>
        <h2 className='mt-1 text-lg font-bold leading-snug tracking-tight text-foreground'>
          {entity.title}
        </h2>
        {entity.artistNames?.length ? (
          <p className='mt-1 text-base text-muted-foreground'>{entity.artistNames.join(', ')}</p>
        ) : null}
        {entity.description ? (
          <p className='mt-3 text-sm leading-relaxed text-muted-foreground'>{entity.description}</p>
        ) : null}
      </div>
    </article>
  )
}
