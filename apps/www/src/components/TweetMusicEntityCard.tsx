import { useQuery } from '@tanstack/react-query'
import { Music4 } from 'lucide-react'
import { fetcher, VPS_BASE_URL } from '@/lib/http'

type MusicEntityType = 'album' | 'track' | 'playlist'

type MusicEntityPreview = {
  id: string
  title: string
  coverImageUrl: string | null
  slug: string
  artistNames?: string[] | null
  description?: string | null
}

const entityPathByType: Record<MusicEntityType, string> = {
  album: 'albums',
  track: 'tracks',
  playlist: 'playlists'
}

const entityLabelByType: Record<MusicEntityType, string> = {
  album: 'Album',
  track: 'Track',
  playlist: 'Playlist'
}

type Props = {
  entityType: string
  entityId: string
}

function isMusicEntityType(value: string): value is MusicEntityType {
  return value === 'album' || value === 'track' || value === 'playlist'
}

export function TweetMusicEntityCard({ entityType, entityId }: Props) {
  const supportedType: MusicEntityType | null = isMusicEntityType(entityType)
    ? entityType
    : null

  const { data, isPending } = useQuery<MusicEntityPreview>({
    queryKey: ['music-entity', entityType, entityId],
    queryFn: () => {
      if (!supportedType) {
        return Promise.reject(new Error('Unsupported music entity type'))
      }

      return fetcher(
        `${VPS_BASE_URL}/music/${entityPathByType[supportedType]}/${entityId}`
      )
    },
    enabled: Boolean(supportedType && entityId)
  })

  if (!supportedType) {
    return null
  }

  if (isPending) {
    return (
      <div className='not-prose flex items-center gap-4 rounded-md border border-border/50 bg-muted/20 p-3 animate-pulse'>
        <div className='h-24 w-24 shrink-0 rounded-sm bg-muted sm:h-28 sm:w-28' />
        <div className='flex-1 space-y-2'>
          <div className='h-2.5 w-16 rounded-full bg-muted' />
          <div className='h-4 w-2/3 rounded-full bg-muted' />
          <div className='h-3 w-1/3 rounded-full bg-muted' />
        </div>
      </div>
    )
  }

  if (!data) {
    return null
  }

  return (
    <section className='not-prose overflow-hidden rounded-md border border-border/50 bg-muted/20 transition-colors hover:bg-muted/30'>
      <div className='flex gap-4 p-3'>
        <div className='flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-sm bg-muted sm:h-28 sm:w-28'>
          {data.coverImageUrl ? (
            <img
              src={data.coverImageUrl}
              alt={data.title}
              className='h-full w-full object-cover'
              loading='lazy'
            />
          ) : (
            <Music4 className='h-8 w-8 text-muted-foreground/70' />
          )}
        </div>

        <div className='min-w-0 flex-1 self-center space-y-0.5'>
          <div className='text-[10px] font-bold uppercase tracking-[0.3em] text-muted-foreground/60'>
            {entityLabelByType[supportedType]}
          </div>
          <h2 className='truncate text-[15px] font-bold leading-snug tracking-tight text-foreground'>
            {data.title}
          </h2>
          {data.artistNames?.length ? (
            <p className='truncate text-sm text-muted-foreground'>
              {data.artistNames.join(', ')}
            </p>
          ) : null}
        </div>
      </div>

      {data.description ? (
        <p className='border-t border-border/40 px-3 py-2 text-xs leading-relaxed text-muted-foreground'>
          {data.description}
        </p>
      ) : null}
    </section>
  )
}
