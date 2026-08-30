import { LINK_STATUS } from '@gbfm/core/status'
import { useQuery } from '@tanstack/react-query'
import { apiUrl, fetcher } from '@/lib/http'
import {
  entityLabelByType,
  entityPathByType,
  isMusicEntityType,
  type MusicEntityType
} from './entity-labels'

export { entityLabelByType, isMusicEntityType, type MusicEntityType }

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
