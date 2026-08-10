import { LINK_STATUS } from '@gbfm/core/status'
import { eq } from 'drizzle-orm'
import { Context, Effect, Layer } from 'effect'
import { Database, type DatabaseClient } from '@/db/layer'
import {
  musicEntityLinksTable,
  musicPlaylistsTable,
  musicTracksTable,
  type SelectMusicPlaylist
} from '@/db/music-entity.schema'
import { DatabaseError, getErrorMessage } from '@/errors'
import type { SpotifyImportPlaylist, SpotifyImportTrack } from '@/services/spotify.service'
import { toSlug } from '@/services/to-slug'
import { findEntityIdBySpotifyUrl, uniqueSlug } from './music-entity/shared'

export type SpotifyImportEntityType = 'track' | 'playlist'

export const canonicalSpotifyImportResolverName = (
  entityType: SpotifyImportEntityType,
  url: string
): string => `spotify-import:${entityType}:${url}`

export type ResolvedSpotifyTrack = {
  readonly trackId: string
  readonly created: boolean
}

export interface SpotifyImportResolverShape {
  readonly resolveTrack: (
    track: SpotifyImportTrack
  ) => Effect.Effect<ResolvedSpotifyTrack, DatabaseError>
  readonly resolvePlaylist: (
    playlist: SpotifyImportPlaylist,
    coverImageUrl: string | null,
    curatorId: string | null | undefined
  ) => Effect.Effect<SelectMusicPlaylist, DatabaseError>
}

export class SpotifyImportResolver extends Context.Service<
  SpotifyImportResolver,
  SpotifyImportResolverShape
>()('SpotifyImportResolver') {}

export const resolveSpotifyTrack = async (
  db: DatabaseClient,
  track: SpotifyImportTrack
): Promise<ResolvedSpotifyTrack> => {
  const existingTrackId = await findEntityIdBySpotifyUrl(db, 'track', track.trackUrl)
  if (existingTrackId) return { trackId: existingTrackId, created: false }

  const trackId = crypto.randomUUID()
  const slug = await uniqueSlug(
    db,
    musicTracksTable,
    toSlug(`${track.artistNames.join(' ')} ${track.title}`)
  )
  const now = new Date()

  await db.batch([
    db
      .insert(musicEntityLinksTable)
      .values({
        entityType: 'track',
        entityId: trackId,
        platform: 'spotify',
        url: track.trackUrl,
        status: LINK_STATUS.VERIFIED,
        metadata: {
          spotifyTrackId: track.spotifyTrackId,
          durationMs: track.durationMs,
          previewUrl: track.previewUrl,
          albumName: track.albumName,
          albumSpotifyId: track.albumSpotifyId
        }
      })
      .onConflictDoNothing(),
    db.insert(musicTracksTable).values({
      id: trackId,
      title: track.title,
      artistNames: track.artistNames,
      coverImageUrl: track.albumImageUrl,
      trackNumber: track.trackNumber,
      slug,
      createdAt: now,
      updatedAt: now
    })
  ])

  const resolvedTrackId = await findEntityIdBySpotifyUrl(db, 'track', track.trackUrl)
  if (!resolvedTrackId) throw new Error('Unable to resolve Spotify track identity')
  return { trackId: resolvedTrackId, created: resolvedTrackId === trackId }
}

export const resolveSpotifyPlaylist = async (
  db: DatabaseClient,
  playlist: SpotifyImportPlaylist,
  coverImageUrl: string | null,
  curatorId: string | null | undefined
): Promise<SelectMusicPlaylist> => {
  const existingPlaylistId = await findEntityIdBySpotifyUrl(db, 'playlist', playlist.playlistUrl)
  if (existingPlaylistId) {
    const rows = await db
      .select()
      .from(musicPlaylistsTable)
      .where(eq(musicPlaylistsTable.id, existingPlaylistId))
      .limit(1)
    const existing = rows[0]
    if (!existing) throw new Error('Spotify playlist link references no playlist')
    return existing
  }

  const id = crypto.randomUUID()
  const slug = await uniqueSlug(db, musicPlaylistsTable, toSlug(playlist.title))
  const now = new Date()

  await db.batch([
    db
      .insert(musicEntityLinksTable)
      .values({
        entityType: 'playlist',
        entityId: id,
        platform: 'spotify',
        url: playlist.playlistUrl,
        status: LINK_STATUS.VERIFIED,
        metadata: { spotifyPlaylistId: playlist.spotifyPlaylistId }
      })
      .onConflictDoNothing(),
    db.insert(musicPlaylistsTable).values({
      id,
      title: playlist.title,
      description: playlist.description,
      coverImageUrl: coverImageUrl ?? playlist.coverImageUrl,
      curatorId: curatorId ?? null,
      slug,
      createdAt: now,
      updatedAt: now,
      revision: 0
    })
  ])

  const resolvedPlaylistId = await findEntityIdBySpotifyUrl(db, 'playlist', playlist.playlistUrl)
  if (!resolvedPlaylistId) throw new Error('Unable to resolve Spotify playlist identity')
  const rows = await db
    .select()
    .from(musicPlaylistsTable)
    .where(eq(musicPlaylistsTable.id, resolvedPlaylistId))
    .limit(1)
  const resolved = rows[0]
  if (!resolved) throw new Error('Spotify playlist link references no playlist')
  return resolved
}

const serialiseByKey = () => {
  const tails = new Map<string, Promise<void>>()

  return <A>(key: string, operation: () => Promise<A>): Promise<A> => {
    const previous = tails.get(key) ?? Promise.resolve()
    const result = previous.then(operation, operation)
    const tail = result.then(
      () => undefined,
      () => undefined
    )
    tails.set(key, tail)
    return result.finally(() => {
      if (tails.get(key) === tail) tails.delete(key)
    })
  }
}

export const SpotifyImportResolverLocalLayer = Layer.effect(
  SpotifyImportResolver,
  Effect.gen(function* () {
    const db = yield* Database
    const serialise = serialiseByKey()

    const resolve = <A>(
      entityType: SpotifyImportEntityType,
      url: string,
      operation: () => Promise<A>
    ) =>
      Effect.tryPromise({
        try: () => serialise(canonicalSpotifyImportResolverName(entityType, url), operation),
        catch: (error) =>
          new DatabaseError({
            message: `Failed to resolve Spotify ${entityType}: ${getErrorMessage(error)}`,
            operation: 'insert',
            table: 'music_entity_links'
          })
      })

    return {
      resolveTrack: (track) =>
        resolve('track', track.trackUrl, () => resolveSpotifyTrack(db, track)),
      resolvePlaylist: (playlist, coverImageUrl, curatorId) =>
        resolve('playlist', playlist.playlistUrl, () =>
          resolveSpotifyPlaylist(db, playlist, coverImageUrl, curatorId)
        )
    } satisfies SpotifyImportResolverShape
  })
)
