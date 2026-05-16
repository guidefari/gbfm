import { and, desc, eq } from 'drizzle-orm'
import { Effect } from 'effect'
import type { db as DbType } from '@/db'
import {
  musicEntityLinksTable,
  musicPlaylistsTable
} from '@/db/music-entity.schema'
import { DatabaseError, getErrorMessage } from '@/errors'
import { toSlug } from '@/services/to-slug'
import { deleteLinksForEntityTx, requireInserted, requireOne } from './shared'

export interface CreatePlaylistInput {
  title: string
  description?: string | null
  coverImageUrl?: string | null
  curatorId?: string | null
  slug: string
  publishedAt?: Date | null
  createdById?: string | null
}

export const createPlaylistEffect = (db: typeof DbType) =>
  Effect.fn('musicEntity.createPlaylist')(function* (
    data: CreatePlaylistInput
  ) {
    const rows = yield* Effect.tryPromise({
      try: () => db.insert(musicPlaylistsTable).values(data).returning(),
      catch: (e) =>
        new DatabaseError({
          message: `Failed to create playlist: ${getErrorMessage(e)}`,
          operation: 'insert',
          table: 'music_playlists'
        })
    })
    return yield* requireInserted(rows, 'music_playlists')
  })

export const getPlaylistsEffect = (db: typeof DbType) => () =>
  Effect.gen(function* () {
    return yield* Effect.tryPromise({
      try: async () => {
        const rows = await db
          .select({
            playlist: musicPlaylistsTable,
            spotifyUrl: musicEntityLinksTable.url
          })
          .from(musicPlaylistsTable)
          .leftJoin(
            musicEntityLinksTable,
            and(
              eq(musicEntityLinksTable.entityType, 'playlist'),
              eq(musicEntityLinksTable.entityId, musicPlaylistsTable.id),
              eq(musicEntityLinksTable.platform, 'spotify')
            )
          )
          .orderBy(desc(musicPlaylistsTable.createdAt))
        return rows.map((r) => ({ ...r.playlist, spotifyUrl: r.spotifyUrl }))
      },
      catch: (e) =>
        new DatabaseError({
          message: `Failed to list playlists: ${getErrorMessage(e)}`,
          operation: 'select',
          table: 'music_playlists'
        })
    })
  }).pipe(Effect.withSpan('musicEntity.getPlaylists'))

export const getPlaylistByIdEffect = (db: typeof DbType) => (id: string) =>
  Effect.gen(function* () {
    const rows = yield* Effect.tryPromise({
      try: async () => {
        const result = await db
          .select({
            playlist: musicPlaylistsTable,
            spotifyUrl: musicEntityLinksTable.url
          })
          .from(musicPlaylistsTable)
          .leftJoin(
            musicEntityLinksTable,
            and(
              eq(musicEntityLinksTable.entityType, 'playlist'),
              eq(musicEntityLinksTable.entityId, musicPlaylistsTable.id),
              eq(musicEntityLinksTable.platform, 'spotify')
            )
          )
          .where(eq(musicPlaylistsTable.id, id))
          .limit(1)
        return result.map((r) => ({ ...r.playlist, spotifyUrl: r.spotifyUrl }))
      },
      catch: (e) =>
        new DatabaseError({
          message: `Failed to get playlist: ${getErrorMessage(e)}`,
          operation: 'select',
          table: 'music_playlists'
        })
    })
    return yield* requireOne(rows, 'MusicPlaylist', id)
  }).pipe(
    Effect.withSpan('musicEntity.getPlaylistById', { attributes: { id } })
  )

export const updatePlaylistEffect =
  (db: typeof DbType) => (id: string, data: Partial<CreatePlaylistInput>) =>
    Effect.gen(function* () {
      const updateData = { ...data }
      if (updateData.title && !updateData.slug) {
        updateData.slug = toSlug(updateData.title)
      }
      const rows = yield* Effect.tryPromise({
        try: () =>
          db
            .update(musicPlaylistsTable)
            .set({ ...updateData, updatedAt: new Date() })
            .where(eq(musicPlaylistsTable.id, id))
            .returning(),
        catch: (e) =>
          new DatabaseError({
            message: `Failed to update playlist: ${getErrorMessage(e)}`,
            operation: 'update',
            table: 'music_playlists'
          })
      })
      return yield* requireOne(rows, 'MusicPlaylist', id)
    }).pipe(
      Effect.withSpan('musicEntity.updatePlaylist', { attributes: { id } })
    )

export const deletePlaylistEffect = (db: typeof DbType) => (id: string) =>
  Effect.gen(function* () {
    const rows = yield* Effect.tryPromise({
      try: () =>
        db.transaction(async (tx) => {
          await deleteLinksForEntityTx(tx, 'playlist', id)
          return tx
            .delete(musicPlaylistsTable)
            .where(eq(musicPlaylistsTable.id, id))
            .returning({ id: musicPlaylistsTable.id })
        }),
      catch: (e) =>
        new DatabaseError({
          message: `Failed to delete playlist: ${getErrorMessage(e)}`,
          operation: 'delete',
          table: 'music_playlists'
        })
    })
    yield* requireOne(rows, 'MusicPlaylist', id)
  }).pipe(Effect.withSpan('musicEntity.deletePlaylist', { attributes: { id } }))
