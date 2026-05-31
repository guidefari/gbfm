import { desc, eq, sql } from 'drizzle-orm'
import { Effect } from 'effect'
import type { db as DbType } from '@/db'
import { musicAlbumArtistsTable, musicAlbumsTable } from '@/db/music-entity.schema'
import { DatabaseError, getErrorMessage } from '@/errors'
import { toSlug } from '@/services/to-slug'
import { deleteLinksForEntityTx, requireOne } from './shared'

export interface CreateAlbumInput {
  title: string
  artistNames?: string[] | null
  artistIds?: string[]
  releaseDate?: Date | null
  coverImageUrl?: string | null
  genres?: string[] | null
  albumType?: string | null
  slug: string
  publishedAt?: Date | null
  createdById?: string | null
}

export const createAlbumEffect = (db: typeof DbType) =>
  Effect.fn('musicEntity.createAlbum')(function* (data: CreateAlbumInput) {
    const { artistIds, ...albumData } = data

    return yield* Effect.tryPromise({
      try: () =>
        db.transaction(async (tx) => {
          const rows = await tx.insert(musicAlbumsTable).values(albumData).returning()
          const album = rows[0]
          if (!album) throw new Error('Insert returned no rows')

          if (artistIds?.length) {
            const linkRows = artistIds.map((artistId, i) => ({
              albumId: album.id,
              artistId,
              displayOrder: i
            }))
            await tx
              .insert(musicAlbumArtistsTable)
              .values(linkRows)
              .onConflictDoUpdate({
                target: [musicAlbumArtistsTable.albumId, musicAlbumArtistsTable.artistId],
                set: { displayOrder: sql`excluded."displayOrder"` }
              })
          }

          return album
        }),
      catch: (e) =>
        new DatabaseError({
          message: `Failed to create album: ${getErrorMessage(e)}`,
          operation: 'insert',
          table: 'music_albums'
        })
    })
  })

export const getAlbumsEffect = (db: typeof DbType) => () =>
  Effect.tryPromise({
    try: () => db.select().from(musicAlbumsTable).orderBy(desc(musicAlbumsTable.createdAt)),
    catch: (e) =>
      new DatabaseError({
        message: `Failed to list albums: ${getErrorMessage(e)}`,
        operation: 'select',
        table: 'music_albums'
      })
  }).pipe(Effect.withSpan('musicEntity.getAlbums'))

export const getAlbumByIdEffect = (db: typeof DbType) => (id: string) =>
  Effect.gen(function* () {
    const rows = yield* Effect.tryPromise({
      try: () => db.select().from(musicAlbumsTable).where(eq(musicAlbumsTable.id, id)).limit(1),
      catch: (e) =>
        new DatabaseError({
          message: `Failed to get album: ${getErrorMessage(e)}`,
          operation: 'select',
          table: 'music_albums'
        })
    })
    return yield* requireOne(rows, 'MusicAlbum', id)
  }).pipe(Effect.withSpan('musicEntity.getAlbumById', { attributes: { id } }))

export const updateAlbumEffect =
  (db: typeof DbType) => (id: string, data: Partial<CreateAlbumInput>) =>
    Effect.gen(function* () {
      const { artistIds, ...albumData } = data
      if (albumData.title && !albumData.slug) {
        albumData.slug = toSlug(albumData.title)
      }

      return yield* Effect.tryPromise({
        try: () =>
          db.transaction(async (tx) => {
            const rows = await tx
              .update(musicAlbumsTable)
              .set({ ...albumData, updatedAt: new Date() })
              .where(eq(musicAlbumsTable.id, id))
              .returning()

            const album = rows[0]
            if (!album) throw new Error('Album not found')

            if (artistIds?.length) {
              const linkRows = artistIds.map((artistId, i) => ({
                albumId: id,
                artistId,
                displayOrder: i
              }))
              await tx
                .insert(musicAlbumArtistsTable)
                .values(linkRows)
                .onConflictDoUpdate({
                  target: [musicAlbumArtistsTable.albumId, musicAlbumArtistsTable.artistId],
                  set: { displayOrder: sql`excluded."displayOrder"` }
                })
            }

            return album
          }),
        catch: (e) =>
          new DatabaseError({
            message: `Failed to update album: ${getErrorMessage(e)}`,
            operation: 'update',
            table: 'music_albums'
          })
      })
    }).pipe(Effect.withSpan('musicEntity.updateAlbum', { attributes: { id } }))

export const deleteAlbumEffect = (db: typeof DbType) => (id: string) =>
  Effect.gen(function* () {
    const rows = yield* Effect.tryPromise({
      try: () =>
        db.transaction(async (tx) => {
          await deleteLinksForEntityTx(tx, 'album', id)
          return tx
            .delete(musicAlbumsTable)
            .where(eq(musicAlbumsTable.id, id))
            .returning({ id: musicAlbumsTable.id })
        }),
      catch: (e) =>
        new DatabaseError({
          message: `Failed to delete album: ${getErrorMessage(e)}`,
          operation: 'delete',
          table: 'music_albums'
        })
    })
    yield* requireOne(rows, 'MusicAlbum', id)
  }).pipe(Effect.withSpan('musicEntity.deleteAlbum', { attributes: { id } }))

export const addArtistToAlbumEffect =
  (db: typeof DbType) =>
  (albumId: string, artistId: string, opts?: { role?: string; displayOrder?: number }) =>
    Effect.tryPromise({
      try: () =>
        db
          .insert(musicAlbumArtistsTable)
          .values({
            albumId,
            artistId,
            role: opts?.role,
            displayOrder: opts?.displayOrder ?? 0
          })
          .onConflictDoUpdate({
            target: [musicAlbumArtistsTable.albumId, musicAlbumArtistsTable.artistId],
            set: { role: opts?.role, displayOrder: opts?.displayOrder ?? 0 }
          }),
      catch: (e) =>
        new DatabaseError({
          message: `Failed to add artist to album: ${getErrorMessage(e)}`,
          operation: 'insert',
          table: 'music_album_artists'
        })
    }).pipe(
      Effect.asVoid,
      Effect.withSpan('musicEntity.addArtistToAlbum', {
        attributes: { albumId, artistId }
      })
    )

export const removeArtistFromAlbumEffect =
  (db: typeof DbType) => (albumId: string, artistId: string) =>
    Effect.tryPromise({
      try: () =>
        db
          .delete(musicAlbumArtistsTable)
          .where(
            eq(musicAlbumArtistsTable.albumId, albumId) &&
              eq(musicAlbumArtistsTable.artistId, artistId)
          ),
      catch: (e) =>
        new DatabaseError({
          message: `Failed to remove artist from album: ${getErrorMessage(e)}`,
          operation: 'delete',
          table: 'music_album_artists'
        })
    }).pipe(
      Effect.asVoid,
      Effect.withSpan('musicEntity.removeArtistFromAlbum', {
        attributes: { albumId, artistId }
      })
    )
