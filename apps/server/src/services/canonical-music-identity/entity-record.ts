import { sql } from 'drizzle-orm'
import { Effect } from 'effect'
import type { DatabaseClient } from '@/db/layer'
import { Database } from '@/db/layer'
import {
  musicAlbumsTable,
  musicArtistsTable,
  musicPlaylistsTable,
  musicTracksTable,
  type SelectMusicAlbum,
  type SelectMusicArtist,
  type SelectMusicPlaylist,
  type SelectMusicTrack
} from '@/db/music-entity.schema'
import { getAlbumByIdEffect } from '@/services/music-entity/album.service'
import { getArtistByIdEffect } from '@/services/music-entity/artist.service'
import { getPlaylistByIdEffect } from '@/services/music-entity/playlist.service'
import { uniqueSlug } from '@/services/music-entity/shared'
import { getTrackByIdEffect } from '@/services/music-entity/track.service'
import type { ScrapeResult } from '@/services/music-link-scraper.service'
import { parseArtistNames } from '@/services/parse-artist-names'
import { toSlug } from '@/services/to-slug'
import { MusicIdentityEntityNotFound, MusicIdentityStorageError } from './errors'
import type { EntityArtist, EntityRecord, EntityReference } from './repository'

export type ResolvedEntity =
  | SelectMusicArtist
  | SelectMusicAlbum
  | SelectMusicTrack
  | (SelectMusicPlaylist & { readonly spotifyUrl?: string | null })

const unreachable = (value: never): never => {
  throw new Error(`Unexpected canonical music entity type: ${String(value)}`)
}

const storageError = (operation: string, message: string) =>
  new MusicIdentityStorageError({ operation, message })

const translateEntityError = (reference: EntityReference) =>
  Effect.mapError((error: { readonly _tag: string; readonly message: string }) =>
    error._tag === 'NotFoundError'
      ? new MusicIdentityEntityNotFound(reference)
      : storageError('loadEntity', error.message)
  )

export const loadEntity = (
  reference: EntityReference
): Effect.Effect<
  ResolvedEntity,
  MusicIdentityEntityNotFound | MusicIdentityStorageError,
  Database
> => {
  switch (reference.entityType) {
    case 'artist':
      return getArtistByIdEffect(reference.entityId).pipe(translateEntityError(reference))
    case 'album':
      return getAlbumByIdEffect(reference.entityId).pipe(translateEntityError(reference))
    case 'track':
      return getTrackByIdEffect(reference.entityId).pipe(translateEntityError(reference))
    case 'playlist':
      return getPlaylistByIdEffect(reference.entityId).pipe(translateEntityError(reference))
    default:
      return unreachable(reference.entityType)
  }
}

const titleFor = (
  entityType: EntityReference['entityType'],
  result: ScrapeResult,
  fallback?: ResolvedEntity
) => {
  const fallbackTitle = fallback ? ('name' in fallback ? fallback.name : fallback.title) : undefined
  if (entityType === 'artist') {
    return (
      result.entityMeta?.artistName ?? result.entityMeta?.title ?? fallbackTitle ?? 'Unknown Artist'
    )
  }
  return (
    result.entityMeta?.title ??
    fallbackTitle ??
    (entityType === 'album'
      ? 'Untitled Album'
      : entityType === 'track'
        ? 'Untitled Track'
        : 'Untitled Playlist')
  )
}

export const storedImageFor = (entity: ResolvedEntity) =>
  'imageUrl' in entity ? (entity.imageUrl ?? undefined) : (entity.coverImageUrl ?? undefined)

const imageFor = (result: ScrapeResult, fallback?: ResolvedEntity) =>
  result.entityMeta?.thumbnailUrl ?? (fallback ? storedImageFor(fallback) : undefined)

const storedArtistNamesFor = (entity: ResolvedEntity) =>
  'artistNames' in entity ? (entity.artistNames ?? []) : []

const artistNamesFor = (result: ScrapeResult, fallback?: ResolvedEntity) => {
  if (result.entityMeta?.artistName) return parseArtistNames(result.entityMeta.artistName)
  return fallback ? storedArtistNamesFor(fallback) : []
}

const prepareArtists = (db: DatabaseClient, names: readonly string[]) =>
  Effect.tryPromise({
    try: async () => {
      const artists: EntityArtist[] = []
      for (const name of names) {
        const rows = await db
          .select({ id: musicArtistsTable.id, name: musicArtistsTable.name })
          .from(musicArtistsTable)
          .where(sql`lower(${musicArtistsTable.name}) = lower(${name})`)
          .limit(1)
        const existing = rows[0]
        if (existing) {
          artists.push({ id: existing.id, name: existing.name, isNew: false })
          continue
        }
        artists.push({
          id: crypto.randomUUID(),
          name,
          slug: await uniqueSlug(db, musicArtistsTable, toSlug(name)),
          isNew: true
        })
      }
      return artists
    },
    catch: (cause) =>
      storageError(
        'prepareArtists',
        cause instanceof Error ? cause.message : 'Artist lookup failed'
      )
  })

export const prepareEntityRecord = (
  db: DatabaseClient,
  entityType: EntityReference['entityType'],
  entityId: string,
  result: ScrapeResult,
  details?: {
    readonly description?: string
    readonly trackNumber?: number
    readonly curatorId?: string | null
  }
) =>
  Effect.gen(function* () {
    const artistNames = artistNamesFor(result)
    const artists =
      entityType === 'album' || entityType === 'track' ? yield* prepareArtists(db, artistNames) : []
    return {
      entityType,
      entityId,
      title: titleFor(entityType, result),
      artistNames: artists.length > 0 ? artists.map((artist) => artist.name) : artistNames,
      artists,
      imageUrl: imageFor(result),
      description: details?.description,
      trackNumber: details?.trackNumber,
      curatorId: details?.curatorId
    } satisfies EntityRecord
  })

export const refreshedEntityRecord = (
  entityType: EntityReference['entityType'],
  entityId: string,
  result: ScrapeResult,
  fallback: ResolvedEntity,
  metadataPolicy: 'preserve_canonical' | 'replace_canonical'
): EntityRecord => ({
  entityType,
  entityId,
  title:
    metadataPolicy === 'replace_canonical'
      ? titleFor(entityType, result, fallback)
      : 'name' in fallback
        ? fallback.name
        : fallback.title,
  artistNames:
    metadataPolicy === 'replace_canonical'
      ? artistNamesFor(result, fallback)
      : storedArtistNamesFor(fallback),
  artists: [],
  imageUrl: storedImageFor(fallback),
  description:
    fallback && 'description' in fallback ? (fallback.description ?? undefined) : undefined
})

export const slugFor = (db: DatabaseClient, entity: EntityRecord) => {
  const base = toSlug(entity.title)
  switch (entity.entityType) {
    case 'artist':
      return uniqueSlug(db, musicArtistsTable, base)
    case 'album':
      return uniqueSlug(db, musicAlbumsTable, base)
    case 'track':
      return uniqueSlug(db, musicTracksTable, base)
    case 'playlist':
      return uniqueSlug(db, musicPlaylistsTable, base)
    default:
      return unreachable(entity.entityType)
  }
}
