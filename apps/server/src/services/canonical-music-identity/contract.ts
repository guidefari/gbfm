import type { Effect } from 'effect'
import type { SelectMusicEntityLink } from '@/db/music-entity.schema'
import type { MusicIdentityError } from './errors'
import type { CanonicalMusicEntityType } from './music-source'
import type { ResolvedEntity } from './entity-record'
import type { ProviderMusicSnapshot } from './source-result'

export type ResolutionOrigin =
  | 'editorial'
  | 'tweet'
  | 'reply'
  | 'bluesky'
  | 'spotify_import'
  | 'playlist_enrichment'
  | 'manual'

export type ResolveMusicSource = {
  readonly url: string
  readonly expectedType?: CanonicalMusicEntityType
  readonly origin: ResolutionOrigin
}

export type ImportProviderMusicEntity = {
  readonly snapshot: ProviderMusicSnapshot
  readonly origin: 'spotify_import' | 'playlist_enrichment'
}

export type AttachMusicSourceLink = {
  readonly entityType: CanonicalMusicEntityType
  readonly entityId: string
  readonly url: string
  readonly origin: 'manual'
}

export type RefreshMusicEntity = {
  readonly entityType: CanonicalMusicEntityType
  readonly entityId: string
  readonly actorId: string
}

export type ResolvedMusicEntity = {
  readonly entity: ResolvedEntity
  readonly links: readonly SelectMusicEntityLink[]
  readonly created: boolean
}

export type RefreshedMusicEntity = {
  readonly entity: ResolvedEntity
  readonly links: readonly SelectMusicEntityLink[]
}

export interface CanonicalMusicIdentityService {
  readonly resolveSource: (
    input: ResolveMusicSource
  ) => Effect.Effect<ResolvedMusicEntity, MusicIdentityError>
  readonly importProviderEntity: (
    input: ImportProviderMusicEntity
  ) => Effect.Effect<ResolvedMusicEntity, MusicIdentityError>
  readonly attachLink: (
    input: AttachMusicSourceLink
  ) => Effect.Effect<SelectMusicEntityLink, MusicIdentityError>
  readonly refreshEntity: (
    input: RefreshMusicEntity
  ) => Effect.Effect<RefreshedMusicEntity, MusicIdentityError>
}
