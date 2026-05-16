import { and, eq } from 'drizzle-orm'
import { Data, Effect } from 'effect'
import type { db as DbType } from '@/db'
import {
  type MusicEntityType,
  type musicAlbumsTable,
  type musicArtistsTable,
  musicEntityLinksTable,
  type musicPlaylistsTable,
  type musicTracksTable
} from '@/db/music-entity.schema'
import { DatabaseError, NotFoundError } from '@/errors'

export class FetchError extends Data.TaggedError('FetchError')<{
  readonly message: string
  readonly cause?: unknown
}> {}

export type DrizzleTransaction = Parameters<
  Parameters<typeof DbType.transaction>[0]
>[0]

export type ImportedTrackTarget = {
  trackId: string
  trackUrl: string
  title: string
  artistNames: string[]
}

export function requireOne<T>(
  rows: T[],
  resource: string,
  id: string
): Effect.Effect<T, NotFoundError> {
  const row = rows[0]
  if (!row) {
    return Effect.fail(
      new NotFoundError({ message: `${resource} not found`, resource, id })
    )
  }
  return Effect.succeed(row)
}

export function requireInserted<T>(
  rows: T[],
  table: string
): Effect.Effect<T, DatabaseError> {
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

export const deleteLinksForEntityTx = (
  tx: DrizzleTransaction,
  entityType: MusicEntityType,
  entityId: string
) =>
  tx
    .delete(musicEntityLinksTable)
    .where(
      and(
        eq(musicEntityLinksTable.entityType, entityType),
        eq(musicEntityLinksTable.entityId, entityId)
      )
    )

export const findEntityIdBySpotifyUrlTx = async (
  tx: DrizzleTransaction,
  entityType: MusicEntityType,
  url: string
) => {
  const rows = await tx
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
  tx: DrizzleTransaction,
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
    const existing = await tx
      .select({ id: table.id })
      .from(table)
      .where(eq(table.slug, candidate))
      .limit(1)
    if (existing.length === 0) return candidate
    n += 1
    candidate = `${base}-${n}`
  }
}
