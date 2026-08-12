import { LINK_STATUS, type LinkStatus } from '@gbfm/core/status'
import { and, eq, sql } from 'drizzle-orm'
import { Effect } from 'effect'
import { Database } from '@/db/layer'
import {
  type InsertMusicEntityLink,
  type MusicEntityType,
  musicEntityLinksTable
} from '@/db/music-entity.schema'
import { DatabaseError, getErrorMessage } from '@/errors'
import { requireInserted, requireOne } from './shared'

export const getLinksForEntityEffect = (
  entityType: MusicEntityType,
  entityId: string,
  statusFilter?: LinkStatus
) =>
  Effect.gen(function* () {
    const db = yield* Database
    return yield* Effect.tryPromise({
      try: () => {
        const conditions = [
          eq(musicEntityLinksTable.entityType, entityType),
          eq(musicEntityLinksTable.entityId, entityId)
        ]
        if (statusFilter) {
          conditions.push(eq(musicEntityLinksTable.status, statusFilter))
        }
        return db
          .select()
          .from(musicEntityLinksTable)
          .where(and(...conditions))
          .orderBy(musicEntityLinksTable.platform)
      },
      catch: (e) =>
        new DatabaseError({
          message: `Failed to get links: ${getErrorMessage(e)}`,
          operation: 'select',
          table: 'music_entity_links'
        })
    })
  }).pipe(
    Effect.withSpan('musicEntity.getLinksForEntity.query', {
      attributes: { entityType, entityId }
    }),
    Effect.tap((rows) => Effect.annotateCurrentSpan('resultCount', rows.length)),
    Effect.withSpan('musicEntity.getLinksForEntity', {
      attributes: { entityType, entityId }
    })
  )

export const addLinkEffect = Effect.fn('musicEntity.addLink')(function* (
  data: InsertMusicEntityLink
) {
  const db = yield* Database
  const rows = yield* Effect.tryPromise({
    try: () =>
      db
        .insert(musicEntityLinksTable)
        .values(data)
        .onConflictDoUpdate({
          target: [
            musicEntityLinksTable.entityType,
            musicEntityLinksTable.entityId,
            musicEntityLinksTable.platform
          ],
          set: {
            url: data.url,
            status: data.status ?? LINK_STATUS.VERIFIED,
            metadata: data.metadata,
            updatedAt: new Date()
          }
        })
        .returning(),
    catch: (e) =>
      new DatabaseError({
        message: `Failed to add link: ${getErrorMessage(e)}`,
        operation: 'insert',
        table: 'music_entity_links'
      })
  })
  return yield* requireInserted(rows, 'music_entity_links')
})

export const updateLinkStatusEffect = (
  entityType: MusicEntityType,
  entityId: string,
  linkId: string,
  status: LinkStatus,
  verifiedBy?: string,
  metadata?: InsertMusicEntityLink['metadata']
) =>
  Effect.gen(function* () {
    const db = yield* Database
    const now = new Date()
    const updateData: Partial<typeof musicEntityLinksTable.$inferInsert> = {
      status,
      updatedAt: now
    }
    if (status === LINK_STATUS.VERIFIED) {
      updateData.verifiedAt = now
      updateData.verifiedBy = verifiedBy
    }
    if (metadata) {
      updateData.metadata = metadata
    }
    const rows = yield* Effect.tryPromise({
      try: () =>
        db
          .update(musicEntityLinksTable)
          .set(updateData)
          .where(
            and(
              eq(musicEntityLinksTable.entityType, entityType),
              eq(musicEntityLinksTable.entityId, entityId),
              eq(musicEntityLinksTable.id, linkId)
            )
          )
          .returning(),
      catch: (e) =>
        new DatabaseError({
          message: `Failed to update link status: ${getErrorMessage(e)}`,
          operation: 'update',
          table: 'music_entity_links'
        })
    })
    return yield* requireOne(rows, 'MusicEntityLink', linkId)
  }).pipe(
    Effect.withSpan('musicEntity.updateLinkStatus', {
      attributes: { entityType, entityId, linkId, status, verifiedBy }
    })
  )

export const deleteLinkEffect = (entityType: MusicEntityType, entityId: string, linkId: string) =>
  Effect.gen(function* () {
    const db = yield* Database
    const rows = yield* Effect.tryPromise({
      try: () =>
        db
          .delete(musicEntityLinksTable)
          .where(
            and(
              eq(musicEntityLinksTable.entityType, entityType),
              eq(musicEntityLinksTable.entityId, entityId),
              eq(musicEntityLinksTable.id, linkId)
            )
          )
          .returning({ id: musicEntityLinksTable.id }),
      catch: (e) =>
        new DatabaseError({
          message: `Failed to delete link: ${getErrorMessage(e)}`,
          operation: 'delete',
          table: 'music_entity_links'
        })
    })
    yield* requireOne(rows, 'MusicEntityLink', linkId)
  }).pipe(
    Effect.withSpan('musicEntity.deleteLink', {
      attributes: { entityType, entityId, linkId }
    })
  )
