import { and, desc, eq, sql } from 'drizzle-orm'
import { Effect } from 'effect'
import { databaseClient as DbType } from '@/db/layer'
import { musicTrackArtistsTable, musicTracksTable } from '@/db/music-entity.schema'
import { DatabaseError, getErrorMessage } from '@/errors'
import { toSlug } from '@/services/to-slug'
import { deleteLinksForEntityTx, requireOne } from './shared'

export interface CreateTrackInput {
  title: string
  artistNames?: string[] | null
  artistIds?: string[]
  coverImageUrl?: string | null
  albumId?: string | null
  trackNumber?: number | null
  slug: string
  publishedAt?: Date | null
  createdById?: string | null
}

export const createTrackEffect = (db: typeof DbType) =>
  Effect.fn('musicEntity.createTrack')(function* (data: CreateTrackInput) {
    const { artistIds, ...trackData } = data

    return yield* Effect.tryPromise({
      try: () =>
        db.transaction(async (tx) => {
          const rows = await tx.insert(musicTracksTable).values(trackData).returning()
          const track = rows[0]
          if (!track) throw new Error('Insert returned no rows')

          if (artistIds?.length) {
            const linkRows = artistIds.map((artistId, i) => ({
              trackId: track.id,
              artistId,
              displayOrder: i
            }))
            await tx
              .insert(musicTrackArtistsTable)
              .values(linkRows)
              .onConflictDoUpdate({
                target: [musicTrackArtistsTable.trackId, musicTrackArtistsTable.artistId],
                set: { displayOrder: sql`excluded."displayOrder"` }
              })
          }

          return track
        }),
      catch: (e) =>
        new DatabaseError({
          message: `Failed to create track: ${getErrorMessage(e)}`,
          operation: 'insert',
          table: 'music_tracks'
        })
    })
  })

export const getTracksEffect = (db: typeof DbType) => () =>
  Effect.tryPromise({
    try: () => db.select().from(musicTracksTable).orderBy(desc(musicTracksTable.createdAt)),
    catch: (e) =>
      new DatabaseError({
        message: `Failed to list tracks: ${getErrorMessage(e)}`,
        operation: 'select',
        table: 'music_tracks'
      })
  }).pipe(Effect.withSpan('musicEntity.getTracks'))

export const getTrackByIdEffect = (db: typeof DbType) => (id: string) =>
  Effect.gen(function* () {
    const rows = yield* Effect.tryPromise({
      try: () => db.select().from(musicTracksTable).where(eq(musicTracksTable.id, id)).limit(1),
      catch: (e) =>
        new DatabaseError({
          message: `Failed to get track: ${getErrorMessage(e)}`,
          operation: 'select',
          table: 'music_tracks'
        })
    })
    return yield* requireOne(rows, 'MusicTrack', id)
  }).pipe(Effect.withSpan('musicEntity.getTrackById', { attributes: { id } }))

export const updateTrackEffect =
  (db: typeof DbType) => (id: string, data: Partial<CreateTrackInput>) =>
    Effect.gen(function* () {
      const { artistIds, ...trackData } = data
      if (trackData.title && !trackData.slug) {
        trackData.slug = toSlug(trackData.title)
      }

      return yield* Effect.tryPromise({
        try: () =>
          db.transaction(async (tx) => {
            const rows = await tx
              .update(musicTracksTable)
              .set({ ...trackData, updatedAt: new Date() })
              .where(eq(musicTracksTable.id, id))
              .returning()

            const track = rows[0]
            if (!track) throw new Error('Track not found')

            if (artistIds?.length) {
              const linkRows = artistIds.map((artistId, i) => ({
                trackId: id,
                artistId,
                displayOrder: i
              }))
              await tx
                .insert(musicTrackArtistsTable)
                .values(linkRows)
                .onConflictDoUpdate({
                  target: [musicTrackArtistsTable.trackId, musicTrackArtistsTable.artistId],
                  set: { displayOrder: sql`excluded."displayOrder"` }
                })
            }

            return track
          }),
        catch: (e) =>
          new DatabaseError({
            message: `Failed to update track: ${getErrorMessage(e)}`,
            operation: 'update',
            table: 'music_tracks'
          })
      })
    }).pipe(Effect.withSpan('musicEntity.updateTrack', { attributes: { id } }))

export const deleteTrackEffect = (db: typeof DbType) => (id: string) =>
  Effect.gen(function* () {
    const rows = yield* Effect.tryPromise({
      try: () =>
        db.transaction(async (tx) => {
          await deleteLinksForEntityTx(tx, 'track', id)
          return tx
            .delete(musicTracksTable)
            .where(eq(musicTracksTable.id, id))
            .returning({ id: musicTracksTable.id })
        }),
      catch: (e) =>
        new DatabaseError({
          message: `Failed to delete track: ${getErrorMessage(e)}`,
          operation: 'delete',
          table: 'music_tracks'
        })
    })
    yield* requireOne(rows, 'MusicTrack', id)
  }).pipe(Effect.withSpan('musicEntity.deleteTrack', { attributes: { id } }))

export const addArtistToTrackEffect =
  (db: typeof DbType) =>
  (trackId: string, artistId: string, opts?: { role?: string; displayOrder?: number }) =>
    Effect.tryPromise({
      try: () =>
        db
          .insert(musicTrackArtistsTable)
          .values({
            trackId,
            artistId,
            role: opts?.role,
            displayOrder: opts?.displayOrder ?? 0
          })
          .onConflictDoUpdate({
            target: [musicTrackArtistsTable.trackId, musicTrackArtistsTable.artistId],
            set: { role: opts?.role, displayOrder: opts?.displayOrder ?? 0 }
          }),
      catch: (e) =>
        new DatabaseError({
          message: `Failed to add artist to track: ${getErrorMessage(e)}`,
          operation: 'insert',
          table: 'music_track_artists'
        })
    }).pipe(
      Effect.asVoid,
      Effect.withSpan('musicEntity.addArtistToTrack', {
        attributes: { trackId, artistId }
      })
    )

export const removeArtistFromTrackEffect =
  (db: typeof DbType) => (trackId: string, artistId: string) =>
    Effect.tryPromise({
      try: () =>
        db
          .delete(musicTrackArtistsTable)
          .where(
            and(
              eq(musicTrackArtistsTable.trackId, trackId),
              eq(musicTrackArtistsTable.artistId, artistId)
            )
          ),
      catch: (e) =>
        new DatabaseError({
          message: `Failed to remove artist from track: ${getErrorMessage(e)}`,
          operation: 'delete',
          table: 'music_track_artists'
        })
    }).pipe(
      Effect.asVoid,
      Effect.withSpan('musicEntity.removeArtistFromTrack', {
        attributes: { trackId, artistId }
      })
    )
