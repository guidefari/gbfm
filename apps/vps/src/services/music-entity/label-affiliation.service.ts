import { and, asc, desc, eq, lte, sql } from 'drizzle-orm'
import { Effect } from 'effect'
import { projectEntityLabelsForRows } from '@/db/labels'
import type { DatabaseClient } from '@/db/layer'
import {
  musicAlbumsTable,
  musicArtistsTable,
  musicLabelAlbumsTable,
  musicLabelArtistsTable,
  musicLabelsTable
} from '@/db/music-entity.schema'
import { DatabaseError, getErrorMessage } from '@/errors'
import { requireOne } from './shared'

const findRequiredEntity = (
  db: DatabaseClient,
  entity: 'MusicLabel' | 'MusicArtist' | 'MusicAlbum',
  id: string
) => {
  const table =
    entity === 'MusicLabel'
      ? musicLabelsTable
      : entity === 'MusicArtist'
        ? musicArtistsTable
        : musicAlbumsTable
  const tableName =
    entity === 'MusicLabel'
      ? 'music_labels'
      : entity === 'MusicArtist'
        ? 'music_artists'
        : 'music_albums'

  return Effect.gen(function* () {
    const rows = yield* Effect.tryPromise({
      try: () => db.select({ id: table.id }).from(table).where(eq(table.id, id)).limit(1),
      catch: (cause) =>
        new DatabaseError({
          message: `Failed to find affiliation entity: ${getErrorMessage(cause)}`,
          operation: 'select',
          table: tableName
        })
    })
    return yield* requireOne(rows, entity, id)
  })
}

/** Lists all artists affiliated with a label for administrative management. */
export const getArtistsForLabelEffect = (db: DatabaseClient) => (labelId: string) =>
  Effect.tryPromise({
    try: async () => {
      const rows = await db
        .select({ artist: musicArtistsTable })
        .from(musicLabelArtistsTable)
        .innerJoin(musicArtistsTable, eq(musicLabelArtistsTable.artistId, musicArtistsTable.id))
        .where(eq(musicLabelArtistsTable.labelId, labelId))
        .orderBy(asc(musicArtistsTable.name))
      const projected = await projectEntityLabelsForRows(
        db,
        'artist',
        rows.map(({ artist }) => artist)
      )
      return projected.map(({ tags: _tags, genres, ...artist }) => ({ ...artist, genres }))
    },
    catch: (cause) =>
      new DatabaseError({
        message: `Failed to list label artists: ${getErrorMessage(cause)}`,
        operation: 'select',
        table: 'music_label_artists'
      })
  }).pipe(Effect.withSpan('musicEntity.getArtistsForLabel', { attributes: { labelId } }))

/** Lists published artists affiliated with a label for public rendering. */
export const getPublishedArtistsForLabelEffect = (db: DatabaseClient) => (labelId: string) =>
  Effect.tryPromise({
    try: async () => {
      const rows = await db
        .select({ artist: musicArtistsTable })
        .from(musicLabelArtistsTable)
        .innerJoin(musicArtistsTable, eq(musicLabelArtistsTable.artistId, musicArtistsTable.id))
        .where(
          and(
            eq(musicLabelArtistsTable.labelId, labelId),
            lte(musicArtistsTable.publishedAt, new Date())
          )
        )
        .orderBy(asc(musicArtistsTable.name))
      const projected = await projectEntityLabelsForRows(
        db,
        'artist',
        rows.map(({ artist }) => artist)
      )
      return projected.map(({ tags: _tags, genres, ...artist }) => ({ ...artist, genres }))
    },
    catch: (cause) =>
      new DatabaseError({
        message: `Failed to list published label artists: ${getErrorMessage(cause)}`,
        operation: 'select',
        table: 'music_label_artists'
      })
  }).pipe(Effect.withSpan('musicEntity.getPublishedArtistsForLabel', { attributes: { labelId } }))

/** Lists all albums affiliated with a label for administrative management. */
export const getAlbumsForLabelEffect = (db: DatabaseClient) => (labelId: string) =>
  Effect.tryPromise({
    try: async () => {
      const rows = await db
        .select({ album: musicAlbumsTable })
        .from(musicLabelAlbumsTable)
        .innerJoin(musicAlbumsTable, eq(musicLabelAlbumsTable.albumId, musicAlbumsTable.id))
        .where(eq(musicLabelAlbumsTable.labelId, labelId))
        .orderBy(
          sql`${musicAlbumsTable.releaseDate} IS NULL`,
          desc(musicAlbumsTable.releaseDate),
          asc(musicAlbumsTable.title)
        )
      const projected = await projectEntityLabelsForRows(
        db,
        'album',
        rows.map(({ album }) => album)
      )
      return projected.map(({ tags: _tags, genres, ...album }) => ({ ...album, genres }))
    },
    catch: (cause) =>
      new DatabaseError({
        message: `Failed to list label albums: ${getErrorMessage(cause)}`,
        operation: 'select',
        table: 'music_label_albums'
      })
  }).pipe(Effect.withSpan('musicEntity.getAlbumsForLabel', { attributes: { labelId } }))

/** Lists published albums affiliated with a label for public rendering. */
export const getPublishedAlbumsForLabelEffect = (db: DatabaseClient) => (labelId: string) =>
  Effect.tryPromise({
    try: async () => {
      const rows = await db
        .select({ album: musicAlbumsTable })
        .from(musicLabelAlbumsTable)
        .innerJoin(musicAlbumsTable, eq(musicLabelAlbumsTable.albumId, musicAlbumsTable.id))
        .where(
          and(
            eq(musicLabelAlbumsTable.labelId, labelId),
            lte(musicAlbumsTable.publishedAt, new Date())
          )
        )
        .orderBy(
          sql`${musicAlbumsTable.releaseDate} IS NULL`,
          desc(musicAlbumsTable.releaseDate),
          asc(musicAlbumsTable.title)
        )
      const projected = await projectEntityLabelsForRows(
        db,
        'album',
        rows.map(({ album }) => album)
      )
      return projected.map(({ tags: _tags, genres, ...album }) => ({ ...album, genres }))
    },
    catch: (cause) =>
      new DatabaseError({
        message: `Failed to list published label albums: ${getErrorMessage(cause)}`,
        operation: 'select',
        table: 'music_label_albums'
      })
  }).pipe(Effect.withSpan('musicEntity.getPublishedAlbumsForLabel', { attributes: { labelId } }))

/** Lists every label affiliated with an artist. */
export const getLabelsForArtistEffect = (db: DatabaseClient) => (artistId: string) =>
  Effect.tryPromise({
    try: async () => {
      const rows = await db
        .select({ label: musicLabelsTable })
        .from(musicLabelArtistsTable)
        .innerJoin(musicLabelsTable, eq(musicLabelArtistsTable.labelId, musicLabelsTable.id))
        .where(eq(musicLabelArtistsTable.artistId, artistId))
        .orderBy(asc(musicLabelsTable.name))
      return projectEntityLabelsForRows(
        db,
        'musicLabel',
        rows.map(({ label }) => label)
      )
    },
    catch: (cause) =>
      new DatabaseError({
        message: `Failed to list artist labels: ${getErrorMessage(cause)}`,
        operation: 'select',
        table: 'music_label_artists'
      })
  }).pipe(Effect.withSpan('musicEntity.getLabelsForArtist', { attributes: { artistId } }))

/** Lists every label affiliated with an album. */
export const getLabelsForAlbumEffect = (db: DatabaseClient) => (albumId: string) =>
  Effect.tryPromise({
    try: async () => {
      const rows = await db
        .select({ label: musicLabelsTable })
        .from(musicLabelAlbumsTable)
        .innerJoin(musicLabelsTable, eq(musicLabelAlbumsTable.labelId, musicLabelsTable.id))
        .where(eq(musicLabelAlbumsTable.albumId, albumId))
        .orderBy(asc(musicLabelsTable.name))
      return projectEntityLabelsForRows(
        db,
        'musicLabel',
        rows.map(({ label }) => label)
      )
    },
    catch: (cause) =>
      new DatabaseError({
        message: `Failed to list album labels: ${getErrorMessage(cause)}`,
        operation: 'select',
        table: 'music_label_albums'
      })
  }).pipe(Effect.withSpan('musicEntity.getLabelsForAlbum', { attributes: { albumId } }))

/** Creates an idempotent factual affiliation between a label and an artist. */
export const affiliateArtistWithLabelEffect =
  (db: DatabaseClient) => (labelId: string, artistId: string) =>
    Effect.gen(function* () {
      yield* Effect.all([
        findRequiredEntity(db, 'MusicLabel', labelId),
        findRequiredEntity(db, 'MusicArtist', artistId)
      ])
      yield* Effect.tryPromise({
        try: () =>
          db.insert(musicLabelArtistsTable).values({ labelId, artistId }).onConflictDoNothing(),
        catch: (cause) =>
          new DatabaseError({
            message: `Failed to affiliate artist with label: ${getErrorMessage(cause)}`,
            operation: 'insert',
            table: 'music_label_artists'
          })
      })
    }).pipe(
      Effect.asVoid,
      Effect.withSpan('musicEntity.affiliateArtistWithLabel', {
        attributes: { labelId, artistId }
      })
    )

/** Removes a factual affiliation between a label and an artist. */
export const unaffiliateArtistFromLabelEffect =
  (db: DatabaseClient) => (labelId: string, artistId: string) =>
    Effect.tryPromise({
      try: () =>
        db
          .delete(musicLabelArtistsTable)
          .where(
            and(
              eq(musicLabelArtistsTable.labelId, labelId),
              eq(musicLabelArtistsTable.artistId, artistId)
            )
          ),
      catch: (cause) =>
        new DatabaseError({
          message: `Failed to remove artist label affiliation: ${getErrorMessage(cause)}`,
          operation: 'delete',
          table: 'music_label_artists'
        })
    }).pipe(
      Effect.asVoid,
      Effect.withSpan('musicEntity.unaffiliateArtistFromLabel', {
        attributes: { labelId, artistId }
      })
    )

/** Creates an idempotent factual affiliation between a label and an album. */
export const affiliateAlbumWithLabelEffect =
  (db: DatabaseClient) => (labelId: string, albumId: string) =>
    Effect.gen(function* () {
      yield* Effect.all([
        findRequiredEntity(db, 'MusicLabel', labelId),
        findRequiredEntity(db, 'MusicAlbum', albumId)
      ])
      yield* Effect.tryPromise({
        try: () =>
          db.insert(musicLabelAlbumsTable).values({ labelId, albumId }).onConflictDoNothing(),
        catch: (cause) =>
          new DatabaseError({
            message: `Failed to affiliate album with label: ${getErrorMessage(cause)}`,
            operation: 'insert',
            table: 'music_label_albums'
          })
      })
    }).pipe(
      Effect.asVoid,
      Effect.withSpan('musicEntity.affiliateAlbumWithLabel', {
        attributes: { labelId, albumId }
      })
    )

/** Removes a factual affiliation between a label and an album. */
export const unaffiliateAlbumFromLabelEffect =
  (db: DatabaseClient) => (labelId: string, albumId: string) =>
    Effect.tryPromise({
      try: () =>
        db
          .delete(musicLabelAlbumsTable)
          .where(
            and(
              eq(musicLabelAlbumsTable.labelId, labelId),
              eq(musicLabelAlbumsTable.albumId, albumId)
            )
          ),
      catch: (cause) =>
        new DatabaseError({
          message: `Failed to remove album label affiliation: ${getErrorMessage(cause)}`,
          operation: 'delete',
          table: 'music_label_albums'
        })
    }).pipe(
      Effect.asVoid,
      Effect.withSpan('musicEntity.unaffiliateAlbumFromLabel', {
        attributes: { labelId, albumId }
      })
    )
