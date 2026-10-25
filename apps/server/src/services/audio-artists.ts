import { asc, eq, inArray } from 'drizzle-orm'
import { Effect } from 'effect'

import { audioArtists, type Creator } from '@/db/audio.schema'
import { Database } from '@/db/layer'
import { musicArtistsTable } from '@/db/music-entity.schema'
import { DatabaseError, ValidationError } from '@/errors'

export const artistCredits = (
  rows: ReadonlyArray<{
    readonly artist: { readonly id: string; readonly name: string; readonly slug: string }
  }>,
) => rows.map(({ artist }) => ({ id: artist.id, name: artist.name, username: artist.slug }))

export const validateAudioArtists = Effect.fn('audio.validateArtists')(function* (
  ids: ReadonlyArray<string> | undefined,
) {
  if (!ids?.length) return
  const db = yield* Database

  const artists = yield* Effect.tryPromise({
    try: () =>
      db
        .select({ id: musicArtistsTable.id })
        .from(musicArtistsTable)
        .where(inArray(musicArtistsTable.id, [...ids])),
    catch: () =>
      new DatabaseError({
        message: 'Could not validate artist credits',
        operation: 'select',
        table: 'music_artists',
      }),
  })

  if (artists.length !== new Set(ids).size)
    yield* new ValidationError({ message: 'Choose existing artists for mix credits' })
})

export const projectAudioArtists = Effect.fn('audio.projectArtists')(function* <
  A extends { readonly id: string },
>(audio: ReadonlyArray<A>) {
  if (audio.length === 0) return []
  const db = yield* Database

  const rows = yield* Effect.tryPromise({
    try: () =>
      db
        .select({
          audioId: audioArtists.audioId,
          id: musicArtistsTable.id,
          name: musicArtistsTable.name,
          username: musicArtistsTable.slug,
        })
        .from(audioArtists)
        .innerJoin(musicArtistsTable, eq(musicArtistsTable.id, audioArtists.artistId))
        .where(
          inArray(
            audioArtists.audioId,
            audio.map(({ id }) => id),
          ),
        )
        .orderBy(asc(audioArtists.position), asc(musicArtistsTable.id)),
    catch: () =>
      new DatabaseError({
        message: 'Could not load artist credits',
        operation: 'select',
        table: 'audio_artists',
      }),
  })

  const byAudio = new Map<string, Array<Creator>>()

  for (const { audioId, ...artist } of rows) {
    const artists = byAudio.get(audioId) ?? []
    artists.push(artist)
    byAudio.set(audioId, artists)
  }

  return audio.map((item) => ({ ...item, artists: byAudio.get(item.id) ?? [] }))
})

export const replaceAudioArtists = Effect.fn('audio.replaceArtists')(function* (
  audioId: string,
  ids: ReadonlyArray<string>,
) {
  const db = yield* Database
  const uniqueIds = [...new Set(ids)]
  yield* Effect.tryPromise({
    try: () =>
      db.batch([
        db.delete(audioArtists).where(eq(audioArtists.audioId, audioId)),
        ...(uniqueIds.length
          ? [
              db
                .insert(audioArtists)
                .values(uniqueIds.map((artistId, position) => ({ audioId, artistId, position }))),
            ]
          : []),
      ]),
    catch: () =>
      new DatabaseError({
        message: 'Could not update artist credits',
        operation: 'transaction',
        table: 'audio_artists',
      }),
  })
})
