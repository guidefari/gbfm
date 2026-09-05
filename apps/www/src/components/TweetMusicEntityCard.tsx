import { queryOptions } from '@tanstack/react-query'
import {
  MusicEntityCard,
  type MusicEntityDisplayProps
} from '@/components/editor/music-entity/MusicEntityCard'
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

const entityPathByType = {
  album: 'albums',
  track: 'tracks',
  playlist: 'playlists'
} satisfies Record<MusicEntityType, string>

type Props = {
  entityType: string
  entityId: string
}

export function isMusicEntityType(value: string): value is MusicEntityType {
  return value === 'album' || value === 'track' || value === 'playlist'
}

export const musicEntityQueryOptions = (entityType: string, entityId: string) =>
  queryOptions({
    queryKey: ['music-entity', entityType, entityId],
    queryFn: () => {
      if (!isMusicEntityType(entityType)) throw new Error('Unsupported music entity type')
      return fetcher<MusicEntityPreview>(
        apiUrl(`/music/${entityPathByType[entityType]}/${entityId}`)
      )
    }
  })

export const musicEntityLinksQueryOptions = (entityType: string, entityId: string) =>
  queryOptions({
    queryKey: ['music-entity-links', entityType, entityId],
    queryFn: () => {
      if (!isMusicEntityType(entityType)) throw new Error('Unsupported music entity type')
      return fetcher<EntityLink[]>(apiUrl(`/music/${entityType}/${entityId}/links?status=verified`))
    }
  })

export function TweetMusicEntityCard({
  entityType,
  entityId,
  ...display
}: Props & MusicEntityDisplayProps) {
  if (!isMusicEntityType(entityType)) return null
  return <MusicEntityCard type={entityType} id={entityId} {...display} />
}
