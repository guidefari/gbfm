import { desc, eq, sql } from 'drizzle-orm'
import { Effect } from 'effect'
import type { db as DbType } from '@/db'
import {
  musicArtistsTable,
  type SelectMusicArtist
} from '@/db/music-entity.schema'
import { DatabaseError, getErrorMessage } from '@/errors'
import { toSlug } from '@/services/to-slug'
import { deleteLinksForEntityTx, requireInserted, requireOne } from './shared'

export interface CreateArtistInput {
  name: string
  bio?: string | null
  imageUrl?: string | null
  genres?: string[] | null
  slug: string
  publishedAt?: Date | null
}

export const createArtistEffect = (db: typeof DbType) =>
  Effect.fn('musicEntity.createArtist')(function* (data: CreateArtistInput) {
    const rows = yield* Effect.tryPromise({
      try: () => db.insert(musicArtistsTable).values(data).returning(),
      catch: (e) =>
        new DatabaseError({
          message: `Failed to create artist: ${getErrorMessage(e)}`,
          operation: 'insert',
          table: 'music_artists'
        })
    })
    return yield* requireInserted(rows, 'music_artists')
  })

export const getArtistsEffect = (db: typeof DbType) => () =>
  Effect.gen(function* () {
    return yield* Effect.tryPromise({
      try: () =>
        db
          .select()
          .from(musicArtistsTable)
          .orderBy(desc(musicArtistsTable.createdAt)),
      catch: (e) =>
        new DatabaseError({
          message: `Failed to list artists: ${getErrorMessage(e)}`,
          operation: 'select',
          table: 'music_artists'
        })
    })
  }).pipe(Effect.withSpan('musicEntity.getArtists'))

export const getArtistByIdEffect = (db: typeof DbType) => (id: string) =>
  Effect.gen(function* () {
    const rows = yield* Effect.tryPromise({
      try: () =>
        db
          .select()
          .from(musicArtistsTable)
          .where(eq(musicArtistsTable.id, id))
          .limit(1),
      catch: (e) =>
        new DatabaseError({
          message: `Failed to get artist: ${getErrorMessage(e)}`,
          operation: 'select',
          table: 'music_artists'
        })
    })
    return yield* requireOne(rows, 'MusicArtist', id)
  }).pipe(Effect.withSpan('musicEntity.getArtistById', { attributes: { id } }))

export const updateArtistEffect =
  (db: typeof DbType) => (id: string, data: Partial<CreateArtistInput>) =>
    Effect.gen(function* () {
      const updateData = { ...data }
      if (updateData.name && !updateData.slug) {
        updateData.slug = toSlug(updateData.name)
      }
      const rows = yield* Effect.tryPromise({
        try: () =>
          db
            .update(musicArtistsTable)
            .set({ ...updateData, updatedAt: new Date() })
            .where(eq(musicArtistsTable.id, id))
            .returning(),
        catch: (e) =>
          new DatabaseError({
            message: `Failed to update artist: ${getErrorMessage(e)}`,
            operation: 'update',
            table: 'music_artists'
          })
      })
      return yield* requireOne(rows, 'MusicArtist', id)
    }).pipe(Effect.withSpan('musicEntity.updateArtist', { attributes: { id } }))

export const deleteArtistEffect = (db: typeof DbType) => (id: string) =>
  Effect.gen(function* () {
    const rows = yield* Effect.tryPromise({
      try: () =>
        db.transaction(async (tx) => {
          await deleteLinksForEntityTx(tx, 'artist', id)
          return tx
            .delete(musicArtistsTable)
            .where(eq(musicArtistsTable.id, id))
            .returning({ id: musicArtistsTable.id })
        }),
      catch: (e) =>
        new DatabaseError({
          message: `Failed to delete artist: ${getErrorMessage(e)}`,
          operation: 'delete',
          table: 'music_artists'
        })
    })
    yield* requireOne(rows, 'MusicArtist', id)
  }).pipe(Effect.withSpan('musicEntity.deleteArtist', { attributes: { id } }))

const findArtistByNameCI = (db: typeof DbType) => (name: string) =>
  Effect.gen(function* () {
    return yield* Effect.tryPromise({
      try: () =>
        db
          .select()
          .from(musicArtistsTable)
          .where(sql`lower(${musicArtistsTable.name}) = lower(${name})`)
          .limit(1),
      catch: (e) =>
        new DatabaseError({
          message: `Failed to find artist: ${getErrorMessage(e)}`,
          operation: 'select',
          table: 'music_artists'
        })
    })
  }).pipe(Effect.withSpan('musicEntity.findArtistByNameCI'))

export const findOrCreateArtist = (db: typeof DbType) =>
  Effect.fn('musicEntity.findOrCreateArtist')(function* (
    name: string,
    opts?: { imageUrl?: string | null }
  ) {
    const rows = yield* findArtistByNameCI(db)(name)
    if (rows[0]) {
      if (opts?.imageUrl && rows[0].imageUrl !== opts.imageUrl) {
        yield* Effect.logInfo(
          `[MusicEntity] Artist "${rows[0].name}" exists with different imageUrl (existing: ${rows[0].imageUrl}, scraped: ${opts.imageUrl}) — skipping update`
        )
      }
      return rows[0]
    }
    return yield* createArtistEffect(db)({
      name,
      slug: toSlug(name),
      imageUrl: opts?.imageUrl
    })
  })

export const findOrCreateArtistsByName = (db: typeof DbType) =>
  Effect.fn('musicEntity.findOrCreateArtistsByName')(function* (
    names: string[]
  ) {
    const artists: SelectMusicArtist[] = []
    for (const name of names) {
      artists.push(yield* findOrCreateArtist(db)(name))
    }
    return artists
  })
