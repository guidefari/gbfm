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

export type ImportProviderMusicEntityLazy<E, R> = {
  readonly entityType: CanonicalMusicEntityType
  readonly sourceUrl: string
  readonly origin: 'spotify_import' | 'playlist_enrichment'
  readonly loadSnapshot: Effect.Effect<ProviderMusicSnapshot, E, R>
}

export type AttachMusicSourceLink = {
  readonly entityType: CanonicalMusicEntityType
  readonly entityId: string
  readonly platform: string
  readonly url: string
  readonly origin: 'manual'
}

export type ReleaseMusicSourceLink = {
  readonly entityType: CanonicalMusicEntityType
  readonly entityId: string
  readonly linkId: string
  readonly action: 'reject' | 'delete'
  readonly verifiedBy?: string
  readonly metadata?: SelectMusicEntityLink['metadata']
}

export type RefreshMusicEntity = {
  readonly entityType: CanonicalMusicEntityType
  readonly entityId: string
  readonly actorId: string
  readonly origin: 'manual' | 'playlist_enrichment'
}

export type ResolvedMusicEntity = {
  readonly entityType: CanonicalMusicEntityType
  readonly entity: ResolvedEntity
  readonly links: readonly SelectMusicEntityLink[]
  readonly created: boolean
}

export type RefreshedMusicEntity = {
  readonly entityType: CanonicalMusicEntityType
  readonly entity: ResolvedEntity
  readonly links: readonly SelectMusicEntityLink[]
  readonly artworkUrl?: string
}

export interface CanonicalMusicIdentityService {
  readonly resolveSource: (
    input: ResolveMusicSource
  ) => Effect.Effect<ResolvedMusicEntity, MusicIdentityError>
  readonly importProviderEntity: (
    input: ImportProviderMusicEntity
  ) => Effect.Effect<ResolvedMusicEntity, MusicIdentityError>
  readonly importProviderEntityLazy: <E, R>(
    input: ImportProviderMusicEntityLazy<E, R>
  ) => Effect.Effect<ResolvedMusicEntity, MusicIdentityError | E, R>
  readonly attachLink: (
    input: AttachMusicSourceLink
  ) => Effect.Effect<SelectMusicEntityLink, MusicIdentityError>
  readonly releaseLink: (
    input: ReleaseMusicSourceLink
  ) => Effect.Effect<SelectMusicEntityLink | undefined, MusicIdentityError>
  readonly enrichEntity: (
    input: RefreshMusicEntity
  ) => Effect.Effect<RefreshedMusicEntity, MusicIdentityError>
  readonly refreshEntity: (
    input: RefreshMusicEntity
  ) => Effect.Effect<RefreshedMusicEntity, MusicIdentityError>
}
