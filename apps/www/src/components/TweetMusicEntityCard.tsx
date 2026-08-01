import { LINK_STATUS } from '@gbfm/core/status'
import { useQuery } from '@tanstack/react-query'
import { Music4 } from 'lucide-react'
import { StreamLinks } from '@/components/StreamLinks'
import { apiUrl, fetcher } from '@/lib/http'

type MusicEntityType = 'album' | 'track' | 'playlist'

type MusicEntityPreview = {
  id: string
  title: string
  coverImageUrl: string | null
  slug: string
  artistNames?: string[] | null
  description?: string | null
}

type EntityLink = {
  id: string
  platform: string
  url: string
  status: string
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
  const supportedType: MusicEntityType | null = isMusicEntityType(entityType) ? entityType : null

  const { data, isPending } = useQuery<MusicEntityPreview>({
    queryKey: ['music-entity', entityType, entityId],
    queryFn: () => {
      if (!supportedType) {
        return Promise.reject(new Error('Unsupported music entity type'))
      }

      return fetcher(apiUrl(`/music/${entityPathByType[supportedType]}/${entityId}`))
    },
    enabled: Boolean(supportedType && entityId)
  })

  // todo: we can probs consolidate this into the music entity query above
  const { data: links, isPending: isLinksPending } = useQuery<EntityLink[]>({
    queryKey: ['music-entity-links', entityType, entityId],
    queryFn: () => fetcher(apiUrl(`/music/${entityType}/${entityId}/links?status=verified`)),
    enabled: Boolean(supportedType && entityId)
  })

  if (!supportedType) {
    return null
  }

  if (isPending || isLinksPending) {
    return (
      <div className='not-prose overflow-hidden rounded-md border border-border/50 bg-muted/20 animate-pulse sm:flex'>
        <div className='aspect-square w-full bg-muted sm:h-40 sm:w-40 sm:shrink-0' />
        <div className='space-y-2 p-4'>
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

  const verifiedLinks = links?.filter((l) => l.status === LINK_STATUS.VERIFIED) ?? []

  return (
    <section className='not-prose overflow-hidden rounded-md border border-border/50 bg-muted/20 sm:flex sm:items-stretch'>
      <div className='flex aspect-square w-full shrink-0 items-center justify-center overflow-hidden bg-muted sm:h-auto sm:w-40'>
        {data.coverImageUrl ? (
          <img
            src={data.coverImageUrl}
            alt={data.title}
            className='h-full w-full object-cover'
            loading='lazy'
          />
        ) : (
          <Music4 className='h-12 w-12 text-muted-foreground/70' />
        )}
      </div>

      <div className='flex min-w-0 flex-1 flex-col'>
        <div className='space-y-1 p-4'>
          <div className='text-[10px] font-bold tracking-[0.3em] text-muted-foreground/60'>
            {entityLabelByType[supportedType]}
          </div>
          <h2 className='text-lg font-bold leading-snug tracking-tight text-foreground'>
            {data.title}
          </h2>
          {data.artistNames?.length ? (
            <p className='text-sm text-muted-foreground'>{data.artistNames.join(', ')}</p>
          ) : null}
        </div>

        {data.description ? (
          <p className='border-t border-border/40 px-4 py-2 text-xs leading-relaxed text-muted-foreground'>
            {data.description}
          </p>
        ) : null}

        {verifiedLinks.length > 0 && (
          <div className='-mx-4 mt-auto overflow-x-auto border-t border-border/40 px-4 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'>
            <div className='w-max'>
              <StreamLinks links={verifiedLinks} />
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
