import { and, eq } from 'drizzle-orm'
import { Data, Effect } from 'effect'
import type { DatabaseClient } from '@/db/layer'
import {
  type MusicEntityType,
  type musicAlbumsTable,
  type musicArtistsTable,
  musicEntityLinksTable,
  type musicPlaylistsTable,
  musicSourceIdentitiesTable,
  type musicTracksTable
} from '@/db/music-entity.schema'
import { entityLabelsTable } from '@/db/tags.schema'
import { DatabaseError, NotFoundError } from '@/errors'

export class FetchError extends Data.TaggedError('FetchError')<{
  readonly message: string
  readonly cause?: unknown
}> {}

export type ImportedTrackTarget = {
  trackId: string
  trackUrl: string
  title: string
  artistNames: string[]
  created?: boolean
}

export function requireOne<T>(
  rows: T[],
  resource: string,
  id: string
): Effect.Effect<T, NotFoundError> {
  const row = rows[0]
  if (!row) {
    return Effect.fail(new NotFoundError({ message: `${resource} not found`, resource, id }))
  }
  return Effect.succeed(row)
}

export function requireInserted<T>(rows: T[], table: string): Effect.Effect<T, DatabaseError> {
  const row = rows[0]
  if (!row) {
    return Effect.fail(
      new DatabaseError({
        message: 'Insert returned no rows',
        operation: 'insert',
        table
      })
    )
  }
  return Effect.succeed(row)
}

export const deleteLinksForEntity = (
  db: DatabaseClient,
  entityType: MusicEntityType,
  entityId: string
) =>
  db
    .delete(musicEntityLinksTable)
    .where(
      and(
        eq(musicEntityLinksTable.entityType, entityType),
        eq(musicEntityLinksTable.entityId, entityId)
      )
    )

export const deleteIdentitiesForEntity = (
  db: DatabaseClient,
  entityType: Exclude<MusicEntityType, 'label'>,
  entityId: string
) =>
  db
    .delete(musicSourceIdentitiesTable)
    .where(
      and(
        eq(musicSourceIdentitiesTable.entityType, entityType),
        eq(musicSourceIdentitiesTable.entityId, entityId)
      )
    )

export const deleteEntityLabels = (
  db: DatabaseClient,
  entityType: 'audio' | 'show' | 'post' | 'release' | 'artist' | 'album' | 'track' | 'musicLabel',
  entityId: string
) =>
  db
    .delete(entityLabelsTable)
    .where(
      and(eq(entityLabelsTable.entityType, entityType), eq(entityLabelsTable.entityId, entityId))
    )

export const findEntityIdBySpotifyUrl = async (
  db: DatabaseClient,
  entityType: MusicEntityType,
  url: string
) => {
  const rows = await db
    .select({ entityId: musicEntityLinksTable.entityId })
    .from(musicEntityLinksTable)
    .where(
      and(
        eq(musicEntityLinksTable.entityType, entityType),
        eq(musicEntityLinksTable.platform, 'spotify'),
        eq(musicEntityLinksTable.url, url)
      )
    )
    .limit(1)
  return rows[0]?.entityId ?? null
}

export const uniqueSlug = async (
  db: DatabaseClient,
  table:
    | typeof musicPlaylistsTable
    | typeof musicTracksTable
    | typeof musicArtistsTable
    | typeof musicAlbumsTable,
  base: string
): Promise<string> => {
  let candidate = base
  let n = 1
  while (true) {
    const existing = await db
      .select({ id: table.id })
      .from(table)
      .where(eq(table.slug, candidate))
      .limit(1)
    if (existing.length === 0) return candidate
    n += 1
    candidate = `${base}-${n}`
  }
}
