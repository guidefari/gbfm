import { LINK_STATUS } from '@gbfm/core/status'
import { useQuery } from '@tanstack/react-query'
import { apiUrl, fetcher } from '@/lib/http'

export type MusicEntityType = 'album' | 'track' | 'playlist'

export type MusicEntityPreview = {
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

export const entityLabelByType: Record<MusicEntityType, string> = {
  album: 'album',
  track: 'track',
  playlist: 'playlist'
}

export function isMusicEntityType(value: string): value is MusicEntityType {
  return value === 'album' || value === 'track' || value === 'playlist'
}

export function useMusicEntity(entityType: string | null, entityId: string | null) {
  const supportedType = entityType && isMusicEntityType(entityType) ? entityType : null

  const { data: entity, isPending } = useQuery<MusicEntityPreview>({
    queryKey: ['music-entity', entityType, entityId],
    queryFn: () => {
      if (!supportedType) {
        return Promise.reject(new Error('Unsupported music entity type'))
      }
      return fetcher(apiUrl(`/music/${entityPathByType[supportedType]}/${entityId}`))
    },
    enabled: Boolean(supportedType && entityId)
  })

  const { data: links } = useQuery<EntityLink[]>({
    queryKey: ['music-entity-links', entityType, entityId],
    queryFn: () => fetcher(apiUrl(`/music/${entityType}/${entityId}/links?status=verified`)),
    enabled: Boolean(supportedType && entityId)
  })

  return {
    entity: supportedType ? entity : undefined,
    entityType: supportedType,
    isPending: Boolean(supportedType) && isPending,
    verifiedLinks: links?.filter((l) => l.status === LINK_STATUS.VERIFIED) ?? []
  }
}
