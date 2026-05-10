import { and, desc, eq, inArray, sql } from 'drizzle-orm'
import { ServiceMap, Data, Effect, Layer } from 'effect'
import { db } from '@/db'
import {
  type InsertMusicEntityLink,
  type LinkStatus,
  type MusicEntityType,
  musicAlbumArtistsTable,
  musicAlbumsTable,
  musicArtistsTable,
  musicEntityLinksTable,
  musicPlaylistsTable,
  musicPlaylistTracksTable,
  musicTrackArtistsTable,
  musicTracksTable,
  type SelectMusicAlbum,
  type SelectMusicArtist,
  type SelectMusicEntityLink,
  type SelectMusicPlaylist,
  type SelectMusicPlaylistTrack,
  type SelectMusicTrack
} from '@/db/music-entity.schema'
import {
  DatabaseError,
  getErrorMessage,
  NotFoundError,
  SpotifyError
} from '@/errors'
import { ConfigService as ConfigServiceTag } from './config.service'
import {
  type MusicLinkScraperService,
  MusicLinkScraperService as MusicLinkScraperServiceTag,
  type MusicScrapeInput
} from './music-link-scraper.service'
import { parseArtistNames } from './parse-artist-names'
import { type S3Service, S3Service as S3ServiceTag } from './s3.service'
import {
  getIdFromSpotifyUrl,
  type SpotifyImportPlaylist,
  type SpotifyService,
  SpotifyService as SpotifyServiceTag
} from './spotify.service'
import { toSlug } from './to-slug'

class FetchError extends Data.TaggedError('FetchError')<{
  readonly message: string
  readonly cause?: unknown
}> {}

// ---------------------------------------------------------------------------
// Input types (Drizzle insert types minus fields we handle separately)
// ---------------------------------------------------------------------------

export interface CreateArtistInput {
  name: string
  bio?: string | null
  imageUrl?: string | null
  genres?: string[] | null
  slug: string
  publishedAt?: Date | null
}

export interface CreateAlbumInput {
  title: string
  artistNames?: string[] | null
  /** Junction-table artist links — inserted separately after the album row */
  artistIds?: string[]
  releaseDate?: Date | null
  coverImageUrl?: string | null
  genres?: string[] | null
  albumType?: string | null
  slug: string
  publishedAt?: Date | null
}

export interface CreateTrackInput {
  title: string
  artistNames?: string[] | null
  /** Junction-table artist links — inserted separately after the track row */
  artistIds?: string[]
  coverImageUrl?: string | null
  albumId?: string | null
  trackNumber?: number | null
  slug: string
  publishedAt?: Date | null
}

export interface CreatePlaylistInput {
  title: string
  description?: string | null
  coverImageUrl?: string | null
  curatorId?: string | null
  slug: string
  publishedAt?: Date | null
}

// ---------------------------------------------------------------------------
// Service interface
// ---------------------------------------------------------------------------

export interface MusicEntityService {
  // Artists
  readonly createArtist: (
    data: CreateArtistInput
  ) => Effect.Effect<SelectMusicArtist, DatabaseError>
  readonly getArtists: () => Effect.Effect<SelectMusicArtist[], DatabaseError>
  readonly getArtistById: (
    id: string
  ) => Effect.Effect<SelectMusicArtist, DatabaseError | NotFoundError>
  readonly updateArtist: (
    id: string,
    data: Partial<CreateArtistInput>
  ) => Effect.Effect<SelectMusicArtist, DatabaseError | NotFoundError>
  readonly deleteArtist: (
    id: string
  ) => Effect.Effect<void, DatabaseError | NotFoundError>

  // Albums
  readonly createAlbum: (
    data: CreateAlbumInput
  ) => Effect.Effect<SelectMusicAlbum, DatabaseError>
  readonly getAlbums: () => Effect.Effect<SelectMusicAlbum[], DatabaseError>
  readonly getAlbumById: (
    id: string
  ) => Effect.Effect<SelectMusicAlbum, DatabaseError | NotFoundError>
  readonly updateAlbum: (
    id: string,
    data: Partial<CreateAlbumInput>
  ) => Effect.Effect<SelectMusicAlbum, DatabaseError | NotFoundError>
  readonly deleteAlbum: (
    id: string
  ) => Effect.Effect<void, DatabaseError | NotFoundError>

  // Tracks
  readonly createTrack: (
    data: CreateTrackInput
  ) => Effect.Effect<SelectMusicTrack, DatabaseError>
  readonly getTracks: () => Effect.Effect<SelectMusicTrack[], DatabaseError>
  readonly getTrackById: (
    id: string
  ) => Effect.Effect<SelectMusicTrack, DatabaseError | NotFoundError>
  readonly updateTrack: (
    id: string,
    data: Partial<CreateTrackInput>
  ) => Effect.Effect<SelectMusicTrack, DatabaseError | NotFoundError>
  readonly deleteTrack: (
    id: string
  ) => Effect.Effect<void, DatabaseError | NotFoundError>

  // Playlists
  readonly createPlaylist: (
    data: CreatePlaylistInput
  ) => Effect.Effect<SelectMusicPlaylist, DatabaseError>
  readonly getPlaylists: () => Effect.Effect<
    (SelectMusicPlaylist & { spotifyUrl: string | null })[],
    DatabaseError
  >
  readonly getPlaylistById: (
    id: string
  ) => Effect.Effect<
    SelectMusicPlaylist & { spotifyUrl: string | null },
    DatabaseError | NotFoundError
  >
  readonly updatePlaylist: (
    id: string,
    data: Partial<CreatePlaylistInput>
  ) => Effect.Effect<SelectMusicPlaylist, DatabaseError | NotFoundError>
  readonly deletePlaylist: (
    id: string
  ) => Effect.Effect<void, DatabaseError | NotFoundError>

  // Playlist tracks
  readonly getPlaylistTracks: (playlistId: string) => Effect.Effect<
    Array<{
      track: SelectMusicTrack
      position: number
      addedAt: Date
      links: SelectMusicEntityLink[]
    }>,
    DatabaseError
  >
  readonly addTrackToPlaylist: (
    playlistId: string,
    trackId: string,
    position: number
  ) => Effect.Effect<SelectMusicPlaylistTrack, DatabaseError>
  readonly removeTrackFromPlaylist: (
    playlistId: string,
    trackId: string
  ) => Effect.Effect<void, DatabaseError>
  readonly reorderPlaylistTracks: (
    playlistId: string,
    trackIds: string[]
  ) => Effect.Effect<void, DatabaseError>
  readonly addSpotifyTrackToPlaylist: (
    playlistId: string,
    spotifyUrl: string
  ) => Effect.Effect<
    { trackId: string; position: number; created: boolean },
    DatabaseError | SpotifyError
  >
  readonly importSpotifyPlaylist: (
    url: string,
    curatorId?: string | null
  ) => Effect.Effect<
    {
      playlist: SelectMusicPlaylist
      trackCount: number
      createdTrackCount: number
      reusedTrackCount: number
    },
    DatabaseError | SpotifyError
  >
  readonly syncPlaylistLinks: (playlistId: string) => Effect.Effect<
    {
      playlistId: string
      queuedTrackCount: number
    },
    DatabaseError | SpotifyError
  >

  // Artist-entity junctions
  readonly addArtistToAlbum: (
    albumId: string,
    artistId: string,
    opts?: { role?: string; displayOrder?: number }
  ) => Effect.Effect<void, DatabaseError>
  readonly removeArtistFromAlbum: (
    albumId: string,
    artistId: string
  ) => Effect.Effect<void, DatabaseError>
  readonly addArtistToTrack: (
    trackId: string,
    artistId: string,
    opts?: { role?: string; displayOrder?: number }
  ) => Effect.Effect<void, DatabaseError>
  readonly removeArtistFromTrack: (
    trackId: string,
    artistId: string
  ) => Effect.Effect<void, DatabaseError>

  // Links
  readonly getLinksForEntity: (
    entityType: MusicEntityType,
    entityId: string,
    statusFilter?: LinkStatus
  ) => Effect.Effect<SelectMusicEntityLink[], DatabaseError>
  readonly addLink: (
    data: InsertMusicEntityLink
  ) => Effect.Effect<SelectMusicEntityLink, DatabaseError>
  readonly updateLinkStatus: (
    entityType: MusicEntityType,
    entityId: string,
    linkId: string,
    status: LinkStatus,
    verifiedBy?: string,
    metadata?: Record<string, unknown>
  ) => Effect.Effect<SelectMusicEntityLink, DatabaseError | NotFoundError>
  readonly deleteLink: (
    entityType: MusicEntityType,
    entityId: string,
    linkId: string
  ) => Effect.Effect<void, DatabaseError | NotFoundError>
  readonly getPendingLinks: (opts?: {
    limit?: number
    offset?: number
  }) => Effect.Effect<SelectMusicEntityLink[], DatabaseError>

  // Scraping
  readonly scrapeAndCreateEntity: (
    entityType: MusicEntityType,
    input: MusicScrapeInput
  ) => Effect.Effect<
    {
      entity:
        | SelectMusicArtist
        | SelectMusicAlbum
        | SelectMusicTrack
        | SelectMusicPlaylist
      links: SelectMusicEntityLink[]
    },
    DatabaseError
  >
}

export const MusicEntityService =
  ServiceMap.Service<MusicEntityService>('MusicEntityService')

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** For reads/updates/deletes: returns NotFoundError when no row comes back. */
function requireOne<T>(
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

/** For inserts: wraps missing row as DatabaseError (should never happen on success). */
function requireInserted<T>(
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

type DrizzleTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0]

const deleteLinksForEntityTx = (
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

// ---------------------------------------------------------------------------
// Artist effects
// ---------------------------------------------------------------------------

const createArtistEffect = Effect.fn('musicEntity.createArtist')(function* (
  data: CreateArtistInput
) {
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

const getArtistsEffect = () =>
  Effect.tryPromise({
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
  }).pipe(Effect.withSpan('musicEntity.getArtists'))

const getArtistByIdEffect = (id: string) =>
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

const updateArtistEffect = (id: string, data: Partial<CreateArtistInput>) =>
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

const deleteArtistEffect = (id: string) =>
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

// ---------------------------------------------------------------------------
// Album effects
// ---------------------------------------------------------------------------

const createAlbumEffect = Effect.fn('musicEntity.createAlbum')(function* (
  data: CreateAlbumInput
) {
  const { artistIds, ...albumData } = data

  return yield* Effect.tryPromise({
    try: () =>
      db.transaction(async (tx) => {
        const rows = await tx
          .insert(musicAlbumsTable)
          .values(albumData)
          .returning()
        const album = rows[0]
        if (!album) {
          throw new Error('Insert returned no rows')
        }

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
              target: [
                musicAlbumArtistsTable.albumId,
                musicAlbumArtistsTable.artistId
              ],
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

const getAlbumsEffect = () =>
  Effect.tryPromise({
    try: () =>
      db
        .select()
        .from(musicAlbumsTable)
        .orderBy(desc(musicAlbumsTable.createdAt)),
    catch: (e) =>
      new DatabaseError({
        message: `Failed to list albums: ${getErrorMessage(e)}`,
        operation: 'select',
        table: 'music_albums'
      })
  }).pipe(Effect.withSpan('musicEntity.getAlbums'))

const getAlbumByIdEffect = (id: string) =>
  Effect.gen(function* () {
    const rows = yield* Effect.tryPromise({
      try: () =>
        db
          .select()
          .from(musicAlbumsTable)
          .where(eq(musicAlbumsTable.id, id))
          .limit(1),
      catch: (e) =>
        new DatabaseError({
          message: `Failed to get album: ${getErrorMessage(e)}`,
          operation: 'select',
          table: 'music_albums'
        })
    })
    return yield* requireOne(rows, 'MusicAlbum', id)
  }).pipe(Effect.withSpan('musicEntity.getAlbumById', { attributes: { id } }))

const updateAlbumEffect = (id: string, data: Partial<CreateAlbumInput>) =>
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
          if (!album) {
            throw new Error('Album not found')
          }

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
                target: [
                  musicAlbumArtistsTable.albumId,
                  musicAlbumArtistsTable.artistId
                ],
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

const deleteAlbumEffect = (id: string) =>
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

// ---------------------------------------------------------------------------
// Track effects
// ---------------------------------------------------------------------------

const createTrackEffect = Effect.fn('musicEntity.createTrack')(function* (
  data: CreateTrackInput
) {
  const { artistIds, ...trackData } = data

  return yield* Effect.tryPromise({
    try: () =>
      db.transaction(async (tx) => {
        const rows = await tx
          .insert(musicTracksTable)
          .values(trackData)
          .returning()
        const track = rows[0]
        if (!track) {
          throw new Error('Insert returned no rows')
        }

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
              target: [
                musicTrackArtistsTable.trackId,
                musicTrackArtistsTable.artistId
              ],
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

const getTracksEffect = () =>
  Effect.tryPromise({
    try: () =>
      db
        .select()
        .from(musicTracksTable)
        .orderBy(desc(musicTracksTable.createdAt)),
    catch: (e) =>
      new DatabaseError({
        message: `Failed to list tracks: ${getErrorMessage(e)}`,
        operation: 'select',
        table: 'music_tracks'
      })
  }).pipe(Effect.withSpan('musicEntity.getTracks'))

const getTrackByIdEffect = (id: string) =>
  Effect.gen(function* () {
    const rows = yield* Effect.tryPromise({
      try: () =>
        db
          .select()
          .from(musicTracksTable)
          .where(eq(musicTracksTable.id, id))
          .limit(1),
      catch: (e) =>
        new DatabaseError({
          message: `Failed to get track: ${getErrorMessage(e)}`,
          operation: 'select',
          table: 'music_tracks'
        })
    })
    return yield* requireOne(rows, 'MusicTrack', id)
  }).pipe(Effect.withSpan('musicEntity.getTrackById', { attributes: { id } }))

const updateTrackEffect = (id: string, data: Partial<CreateTrackInput>) =>
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
          if (!track) {
            throw new Error('Track not found')
          }

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
                target: [
                  musicTrackArtistsTable.trackId,
                  musicTrackArtistsTable.artistId
                ],
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

const deleteTrackEffect = (id: string) =>
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

// ---------------------------------------------------------------------------
// Playlist effects
// ---------------------------------------------------------------------------

const createPlaylistEffect = Effect.fn('musicEntity.createPlaylist')(function* (
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

const getPlaylistsEffect = () =>
  Effect.tryPromise({
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
  }).pipe(Effect.withSpan('musicEntity.getPlaylists'))

const getPlaylistByIdEffect = (id: string) =>
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

const updatePlaylistEffect = (id: string, data: Partial<CreatePlaylistInput>) =>
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
  }).pipe(Effect.withSpan('musicEntity.updatePlaylist', { attributes: { id } }))

const deletePlaylistEffect = (id: string) =>
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

// ---------------------------------------------------------------------------
// Playlist track effects
// ---------------------------------------------------------------------------

const getPlaylistTracksEffect = (playlistId: string) =>
  Effect.tryPromise({
    try: async () => {
      const rows = await db
        .select({
          track: musicTracksTable,
          position: musicPlaylistTracksTable.position,
          addedAt: musicPlaylistTracksTable.addedAt
        })
        .from(musicPlaylistTracksTable)
        .innerJoin(
          musicTracksTable,
          eq(musicPlaylistTracksTable.trackId, musicTracksTable.id)
        )
        .where(eq(musicPlaylistTracksTable.playlistId, playlistId))
        .orderBy(musicPlaylistTracksTable.position)

      const trackIds = rows.map((r) => r.track.id)
      const linkRows =
        trackIds.length === 0
          ? []
          : await db
              .select()
              .from(musicEntityLinksTable)
              .where(
                and(
                  eq(musicEntityLinksTable.entityType, 'track'),
                  inArray(musicEntityLinksTable.entityId, trackIds)
                )
              )

      const linksByTrackId = new Map<string, SelectMusicEntityLink[]>()
      for (const link of linkRows) {
        const list = linksByTrackId.get(link.entityId) ?? []
        list.push(link)
        linksByTrackId.set(link.entityId, list)
      }

      return rows.map((r) => ({
        ...r,
        links: linksByTrackId.get(r.track.id) ?? []
      }))
    },
    catch: (e) =>
      new DatabaseError({
        message: `Failed to get playlist tracks: ${getErrorMessage(e)}`,
        operation: 'select',
        table: 'music_playlist_tracks'
      })
  }).pipe(
    Effect.withSpan('musicEntity.getPlaylistTracks', {
      attributes: { playlistId }
    })
  )

const addTrackToPlaylistEffect = Effect.fn('musicEntity.addTrackToPlaylist')(
  function* (playlistId: string, trackId: string, position: number) {
    const rows = yield* Effect.tryPromise({
      try: () =>
        db
          .insert(musicPlaylistTracksTable)
          .values({ playlistId, trackId, position })
          .onConflictDoUpdate({
            target: [
              musicPlaylistTracksTable.playlistId,
              musicPlaylistTracksTable.trackId
            ],
            set: { position }
          })
          .returning(),
      catch: (e) =>
        new DatabaseError({
          message: `Failed to add track to playlist: ${getErrorMessage(e)}`,
          operation: 'insert',
          table: 'music_playlist_tracks'
        })
    })
    return yield* requireInserted(rows, 'music_playlist_tracks')
  }
)

const removeTrackFromPlaylistEffect = (playlistId: string, trackId: string) =>
  Effect.tryPromise({
    try: () =>
      db
        .delete(musicPlaylistTracksTable)
        .where(
          and(
            eq(musicPlaylistTracksTable.playlistId, playlistId),
            eq(musicPlaylistTracksTable.trackId, trackId)
          )
        ),
    catch: (e) =>
      new DatabaseError({
        message: `Failed to remove track from playlist: ${getErrorMessage(e)}`,
        operation: 'delete',
        table: 'music_playlist_tracks'
      })
  }).pipe(
    Effect.asVoid,
    Effect.withSpan('musicEntity.removeTrackFromPlaylist', {
      attributes: { playlistId, trackId }
    })
  )

const reorderPlaylistTracksEffect = (playlistId: string, trackIds: string[]) =>
  Effect.tryPromise({
    try: () =>
      db.transaction(async (tx) => {
        const existing = await tx
          .select({ trackId: musicPlaylistTracksTable.trackId })
          .from(musicPlaylistTracksTable)
          .where(eq(musicPlaylistTracksTable.playlistId, playlistId))

        const existingSet = new Set(existing.map((r) => r.trackId))
        const incomingSet = new Set(trackIds)

        if (
          existingSet.size !== incomingSet.size ||
          [...existingSet].some((id) => !incomingSet.has(id))
        ) {
          throw new Error(
            'Reorder track set must match current playlist tracks exactly'
          )
        }

        for (let i = 0; i < trackIds.length; i += 1) {
          await tx
            .update(musicPlaylistTracksTable)
            .set({ position: i })
            .where(
              and(
                eq(musicPlaylistTracksTable.playlistId, playlistId),
                eq(musicPlaylistTracksTable.trackId, trackIds[i] as string)
              )
            )
        }
      }),
    catch: (e) =>
      new DatabaseError({
        message: `Failed to reorder tracks: ${getErrorMessage(e)}`,
        operation: 'update',
        table: 'music_playlist_tracks'
      })
  }).pipe(
    Effect.asVoid,
    Effect.withSpan('musicEntity.reorderPlaylistTracks', {
      attributes: { playlistId }
    })
  )

// ---------------------------------------------------------------------------
// Spotify playlist import
// ---------------------------------------------------------------------------

const findEntityIdBySpotifyUrlTx = async (
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
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

const uniqueSlug = async (
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
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

type ImportedTrackTarget = {
  trackId: string
  trackUrl: string
  title: string
  artistNames: string[]
}

const copyCoverImageToCdnEffect = (
  s3: S3Service,
  routerUrl: string,
  bucketName: string,
  entityType: MusicEntityType,
  entityId: string,
  coverImageUrl: string
) =>
  Effect.gen(function* () {
    const response = yield* Effect.tryPromise({
      try: () => fetch(coverImageUrl),
      catch: (cause) =>
        new FetchError({ message: `Failed to fetch ${coverImageUrl}`, cause })
    })

    if (!response.ok) {
      return null
    }

    const contentType = response.headers.get('content-type') || 'image/jpeg'
    const arrayBuffer = yield* Effect.tryPromise({
      try: () => response.arrayBuffer(),
      catch: (cause) =>
        new FetchError({ message: `Failed to read ${coverImageUrl}`, cause })
    })
    const buffer = Buffer.from(arrayBuffer)
    const key = `music/${entityType}/${entityId}/cover`
    const uploadedKey = yield* s3.uploadFile(
      key,
      buffer,
      contentType,
      bucketName
    )

    return `${routerUrl}/user-content/${uploadedKey}`
  }).pipe(Effect.catch(() => Effect.succeed(null)))

const enrichTrackLinksEffect = (
  scraper: MusicLinkScraperService,
  s3: S3Service,
  routerUrl: string,
  bucketName: string,
  playlistId: string,
  track: ImportedTrackTarget
) =>
  Effect.gen(function* () {
    const existingLinks = yield* getLinksForEntityEffect('track', track.trackId)
    const existingPlatforms = new Set(
      existingLinks.map((link) => link.platform)
    )

    const scraped = yield* scraper.scrape({
      url: track.trackUrl,
      trackTitle: track.title,
      artistName: track.artistNames.join(', ')
    })

    const linksToAdd = scraped.links.filter(
      (link) =>
        link.platform !== 'spotify' && !existingPlatforms.has(link.platform)
    )

    const persistedLinks = yield* Effect.forEach(
      linksToAdd,
      (link) =>
        Effect.catch(
          addLinkEffect({
            entityType: 'track',
            entityId: track.trackId,
            platform: link.platform,
            url: link.url,
            status: 'pending_review',
            scrapedAt: link.scrapedAt,
            metadata: link.metadata
          }),
          (error) =>
            Effect.andThen(
              Effect.logWarning(
                '[MusicEntity] Failed to persist scraped track link',
                {
                  playlistId,
                  trackId: track.trackId,
                  platform: link.platform,
                  error: getErrorMessage(error)
                }
              ),
              Effect.succeed<SelectMusicEntityLink | null>(null)
            )
        ),
      { concurrency: 1 }
    )

    if (scraped.entityMeta?.thumbnailUrl) {
      const publicCoverImageUrl = yield* copyCoverImageToCdnEffect(
        s3,
        routerUrl,
        bucketName,
        'track',
        track.trackId,
        scraped.entityMeta.thumbnailUrl
      )

      if (publicCoverImageUrl) {
        yield* updateTrackEffect(track.trackId, {
          coverImageUrl: publicCoverImageUrl
        })
      }
    }

    return {
      scrapedCount: linksToAdd.length,
      insertedCount: persistedLinks.filter((link) => link !== null).length
    }
  }).pipe(
    Effect.withSpan('musicEntity.enrichTrackLinks', {
      attributes: {
        playlistId,
        trackId: track.trackId,
        sourceUrl: track.trackUrl,
        artistCount: track.artistNames.length
      }
    })
  )

const enrichImportedPlaylistLinksEffect = (
  scraper: MusicLinkScraperService,
  s3: S3Service,
  routerUrl: string,
  bucketName: string,
  playlistId: string,
  tracks: ImportedTrackTarget[]
) =>
  Effect.gen(function* () {
    yield* Effect.logInfo(
      '[MusicEntity] Starting background playlist link enrichment',
      {
        playlistId,
        trackCount: tracks.length
      }
    )

    const results = yield* Effect.forEach(
      tracks,
      (track) =>
        enrichTrackLinksEffect(
          scraper,
          s3,
          routerUrl,
          bucketName,
          playlistId,
          track
        ),
      { concurrency: 1 }
    )

    const insertedCount = results.reduce(
      (sum, result) => sum + result.insertedCount,
      0
    )

    yield* Effect.logInfo(
      '[MusicEntity] Completed background playlist link enrichment',
      {
        playlistId,
        trackCount: tracks.length,
        insertedCount
      }
    )

    return { insertedCount }
  }).pipe(
    Effect.withSpan('musicEntity.enrichImportedPlaylistLinks', {
      attributes: {
        playlistId,
        trackCount: tracks.length
      }
    }),
    Effect.catch((error) =>
      Effect.logError(
        '[MusicEntity] Background playlist link enrichment failed',
        {
          playlistId,
          error: getErrorMessage(error)
        }
      )
    )
  )

const getPlaylistLinkSyncTargetsEffect = (playlistId: string) =>
  Effect.gen(function* () {
    const rows = yield* getPlaylistTracksEffect(playlistId)
    return rows.flatMap((row) => {
      const spotifyLink = row.links.find((link) => link.platform === 'spotify')
      if (!spotifyLink) return []

      return [
        {
          trackId: row.track.id,
          trackUrl: spotifyLink.url,
          title: row.track.title,
          artistNames: row.track.artistNames ?? []
        } satisfies ImportedTrackTarget
      ]
    })
  }).pipe(
    Effect.withSpan('musicEntity.getPlaylistLinkSyncTargets', {
      attributes: { playlistId }
    })
  )

const getSpotifyPlaylistUrlEffect = (playlistId: string) =>
  Effect.tryPromise({
    try: async () => {
      const rows = await db
        .select({ url: musicEntityLinksTable.url })
        .from(musicEntityLinksTable)
        .where(
          and(
            eq(musicEntityLinksTable.entityType, 'playlist'),
            eq(musicEntityLinksTable.entityId, playlistId),
            eq(musicEntityLinksTable.platform, 'spotify')
          )
        )
        .limit(1)

      return rows[0]?.url ?? null
    },
    catch: (e) =>
      new DatabaseError({
        message: `Failed to load playlist Spotify URL: ${getErrorMessage(e)}`,
        operation: 'select',
        table: 'music_entity_links'
      })
  }).pipe(
    Effect.withSpan('musicEntity.getSpotifyPlaylistUrl', {
      attributes: { playlistId }
    })
  )

const refreshPlaylistCoverImageEffect = (
  spotify: SpotifyService,
  s3: S3Service,
  routerUrl: string,
  bucketName: string,
  playlistId: string
) =>
  Effect.gen(function* () {
    const spotifyUrl = yield* getSpotifyPlaylistUrlEffect(playlistId)
    if (!spotifyUrl) {
      return { updated: false as const }
    }

    const spotifyPlaylistId = getIdFromSpotifyUrl(spotifyUrl)
    if (!spotifyPlaylistId) {
      return { updated: false as const }
    }

    const data = yield* spotify.getPlaylistForImport(spotifyPlaylistId)
    if (!data.coverImageUrl) {
      return { updated: false as const }
    }

    const publicCoverImageUrl = yield* copyCoverImageToCdnEffect(
      s3,
      routerUrl,
      bucketName,
      'playlist',
      playlistId,
      data.coverImageUrl
    )

    if (!publicCoverImageUrl || publicCoverImageUrl === data.coverImageUrl) {
      return { updated: false as const }
    }

    const updated = yield* Effect.tryPromise({
      try: () =>
        db
          .update(musicPlaylistsTable)
          .set({
            coverImageUrl: publicCoverImageUrl,
            updatedAt: new Date()
          })
          .where(eq(musicPlaylistsTable.id, playlistId))
          .returning(),
      catch: (e) =>
        new DatabaseError({
          message: `Failed to update playlist cover image: ${getErrorMessage(e)}`,
          operation: 'update',
          table: 'music_playlists'
        })
    })

    if (!updated[0]) {
      return { updated: false as const }
    }

    return { updated: true as const, coverImageUrl: publicCoverImageUrl }
  }).pipe(
    Effect.withSpan('musicEntity.refreshPlaylistCoverImage', {
      attributes: { playlistId }
    })
  )

const storeSpotifyPlaylistCoverImageEffect = (
  s3: S3Service,
  routerUrl: string,
  bucketName: string,
  playlistId: string,
  coverImageUrl: string
) =>
  copyCoverImageToCdnEffect(
    s3,
    routerUrl,
    bucketName,
    'playlist',
    playlistId,
    coverImageUrl
  )

const importSpotifyPlaylistEffect = (
  spotify: SpotifyService,
  scraper: MusicLinkScraperService,
  s3: S3Service,
  routerUrl: string,
  bucketName: string
) =>
  Effect.fn('musicEntity.importSpotifyPlaylist')(function* (
    url: string,
    curatorId?: string | null
  ) {
    const id = getIdFromSpotifyUrl(url)
    if (!id) {
      return yield* new SpotifyError({
        message: 'Could not extract Spotify playlist ID from URL',
        operation: 'importSpotifyPlaylist',
        statusCode: 400
      })
    }

    const data: SpotifyImportPlaylist = yield* spotify.getPlaylistForImport(id)
    const storedCoverImageUrl = data.coverImageUrl
      ? yield* storeSpotifyPlaylistCoverImageEffect(
          s3,
          routerUrl,
          bucketName,
          id,
          data.coverImageUrl
        )
      : null
    const importedTracks: ImportedTrackTarget[] = []

    const result = yield* Effect.tryPromise({
      try: () =>
        db.transaction(async (tx) => {
          let createdTrackCount = 0
          let reusedTrackCount = 0

          const existingPlaylistId = await findEntityIdBySpotifyUrlTx(
            tx,
            'playlist',
            data.playlistUrl
          )

          const existingPlaylistCuratorId = existingPlaylistId
            ? ((
                await tx
                  .select({ curatorId: musicPlaylistsTable.curatorId })
                  .from(musicPlaylistsTable)
                  .where(eq(musicPlaylistsTable.id, existingPlaylistId))
                  .limit(1)
              )[0]?.curatorId ?? null)
            : null
          const playlistCuratorId =
            existingPlaylistCuratorId ?? curatorId ?? null

          let playlist: SelectMusicPlaylist
          if (existingPlaylistId) {
            const updated = await tx
              .update(musicPlaylistsTable)
              .set({
                title: data.title,
                description: data.description,
                coverImageUrl: storedCoverImageUrl ?? data.coverImageUrl,
                curatorId: playlistCuratorId,
                updatedAt: new Date()
              })
              .where(eq(musicPlaylistsTable.id, existingPlaylistId))
              .returning()
            const row = updated[0]
            if (!row) throw new Error('Failed to update existing playlist')
            playlist = row
          } else {
            const slug = await uniqueSlug(
              tx,
              musicPlaylistsTable,
              toSlug(data.title)
            )
            const inserted = await tx
              .insert(musicPlaylistsTable)
              .values({
                title: data.title,
                description: data.description,
                coverImageUrl: storedCoverImageUrl ?? data.coverImageUrl,
                curatorId: playlistCuratorId,
                slug
              })
              .returning()
            const row = inserted[0]
            if (!row) throw new Error('Failed to insert playlist')
            playlist = row

            await tx.insert(musicEntityLinksTable).values({
              entityType: 'playlist',
              entityId: playlist.id,
              platform: 'spotify',
              url: data.playlistUrl,
              status: 'verified',
              metadata: { spotifyPlaylistId: data.spotifyPlaylistId }
            })
          }

          await tx
            .delete(musicPlaylistTracksTable)
            .where(eq(musicPlaylistTracksTable.playlistId, playlist.id))

          for (let i = 0; i < data.tracks.length; i += 1) {
            const t = data.tracks[i]
            if (!t) continue

            const existingTrackId = await findEntityIdBySpotifyUrlTx(
              tx,
              'track',
              t.trackUrl
            )

            let trackId: string
            if (existingTrackId) {
              trackId = existingTrackId
              reusedTrackCount += 1
            } else {
              const slug = await uniqueSlug(
                tx,
                musicTracksTable,
                toSlug(`${t.artistNames.join(' ')} ${t.title}`)
              )
              const inserted = await tx
                .insert(musicTracksTable)
                .values({
                  title: t.title,
                  artistNames: t.artistNames,
                  coverImageUrl: t.albumImageUrl,
                  trackNumber: t.trackNumber,
                  slug
                })
                .returning()
              const row = inserted[0]
              if (!row) throw new Error('Failed to insert track')
              trackId = row.id
              createdTrackCount += 1

              await tx.insert(musicEntityLinksTable).values({
                entityType: 'track',
                entityId: trackId,
                platform: 'spotify',
                url: t.trackUrl,
                status: 'verified',
                metadata: {
                  spotifyTrackId: t.spotifyTrackId,
                  durationMs: t.durationMs,
                  previewUrl: t.previewUrl,
                  albumName: t.albumName,
                  albumSpotifyId: t.albumSpotifyId
                }
              })
            }

            await tx
              .insert(musicPlaylistTracksTable)
              .values({ playlistId: playlist.id, trackId, position: i })
              .onConflictDoUpdate({
                target: [
                  musicPlaylistTracksTable.playlistId,
                  musicPlaylistTracksTable.trackId
                ],
                set: { position: i }
              })

            importedTracks.push({
              trackId,
              trackUrl: t.trackUrl,
              title: t.title,
              artistNames: t.artistNames
            })
          }

          return {
            playlist,
            trackCount: data.tracks.length,
            createdTrackCount,
            reusedTrackCount
          }
        }),
      catch: (e) =>
        new DatabaseError({
          message: `Failed to import Spotify playlist: ${getErrorMessage(e)}`,
          operation: 'insert',
          table: 'music_playlists'
        })
    })

    if (importedTracks.length > 0) {
      yield* Effect.logInfo(
        '[MusicEntity] Scheduling background playlist link enrichment',
        {
          playlistId: result.playlist.id,
          trackCount: importedTracks.length
        }
      )

      yield* enrichImportedPlaylistLinksEffect(
        scraper,
        s3,
        routerUrl,
        bucketName,
        result.playlist.id,
        importedTracks
      ).pipe(Effect.forkDetach)
    }

    return result
  })

const syncPlaylistLinksEffect = (
  spotify: SpotifyService,
  scraper: MusicLinkScraperService,
  s3: S3Service,
  routerUrl: string,
  bucketName: string
) =>
  Effect.fn('musicEntity.syncPlaylistLinks')(function* (playlistId: string) {
    return yield* Effect.gen(function* () {
      yield* refreshPlaylistCoverImageEffect(
        spotify,
        s3,
        routerUrl,
        bucketName,
        playlistId
      )

      const targets = yield* getPlaylistLinkSyncTargetsEffect(playlistId)

      if (targets.length === 0) {
        return {
          playlistId,
          queuedTrackCount: 0
        }
      }

      yield* Effect.logInfo(
        '[MusicEntity] Scheduling manual playlist link sync',
        {
          playlistId,
          trackCount: targets.length
        }
      )

      yield* enrichImportedPlaylistLinksEffect(
        scraper,
        s3,
        routerUrl,
        bucketName,
        playlistId,
        targets
      ).pipe(Effect.forkDetach)

      return {
        playlistId,
        queuedTrackCount: targets.length
      }
    }).pipe(
      Effect.withSpan('musicEntity.syncPlaylistLinks', {
        attributes: { playlistId }
      })
    )
  })

const addSpotifyTrackToPlaylistEffect = (spotify: SpotifyService) =>
  Effect.fn('musicEntity.addSpotifyTrackToPlaylist')(function* (
    playlistId: string,
    spotifyUrl: string
  ) {
    const id = getIdFromSpotifyUrl(spotifyUrl)
    if (!id) {
      return yield* new SpotifyError({
        message: 'Could not extract Spotify track ID from URL',
        operation: 'addSpotifyTrackToPlaylist',
        statusCode: 400
      })
    }

    const t = yield* spotify.getTrackForImport(id)

    return yield* Effect.tryPromise({
      try: () =>
        db.transaction(async (tx) => {
          const existingTrackId = await findEntityIdBySpotifyUrlTx(
            tx,
            'track',
            t.trackUrl
          )

          let trackId: string
          let created = false
          if (existingTrackId) {
            trackId = existingTrackId
          } else {
            const slug = await uniqueSlug(
              tx,
              musicTracksTable,
              toSlug(`${t.artistNames.join(' ')} ${t.title}`)
            )
            const inserted = await tx
              .insert(musicTracksTable)
              .values({
                title: t.title,
                artistNames: t.artistNames,
                coverImageUrl: t.albumImageUrl,
                trackNumber: t.trackNumber,
                slug
              })
              .returning()
            const row = inserted[0]
            if (!row) throw new Error('Failed to insert track')
            trackId = row.id
            created = true

            await tx.insert(musicEntityLinksTable).values({
              entityType: 'track',
              entityId: trackId,
              platform: 'spotify',
              url: t.trackUrl,
              status: 'verified',
              metadata: {
                spotifyTrackId: t.spotifyTrackId,
                durationMs: t.durationMs,
                previewUrl: t.previewUrl,
                albumName: t.albumName,
                albumSpotifyId: t.albumSpotifyId
              }
            })
          }

          const maxRow = await tx
            .select({
              max: sql<number | null>`max(${musicPlaylistTracksTable.position})`
            })
            .from(musicPlaylistTracksTable)
            .where(eq(musicPlaylistTracksTable.playlistId, playlistId))
          const nextPosition = (maxRow[0]?.max ?? -1) + 1

          await tx
            .insert(musicPlaylistTracksTable)
            .values({ playlistId, trackId, position: nextPosition })
            .onConflictDoNothing({
              target: [
                musicPlaylistTracksTable.playlistId,
                musicPlaylistTracksTable.trackId
              ]
            })

          const finalRow = await tx
            .select({ position: musicPlaylistTracksTable.position })
            .from(musicPlaylistTracksTable)
            .where(
              and(
                eq(musicPlaylistTracksTable.playlistId, playlistId),
                eq(musicPlaylistTracksTable.trackId, trackId)
              )
            )
            .limit(1)

          return {
            trackId,
            position: finalRow[0]?.position ?? nextPosition,
            created
          }
        }),
      catch: (e) =>
        new DatabaseError({
          message: `Failed to add Spotify track: ${getErrorMessage(e)}`,
          operation: 'insert',
          table: 'music_playlist_tracks'
        })
    })
  })

// ---------------------------------------------------------------------------
// Junction table effects
// ---------------------------------------------------------------------------

const addArtistToAlbumEffect = (
  albumId: string,
  artistId: string,
  opts?: { role?: string; displayOrder?: number }
) =>
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
          target: [
            musicAlbumArtistsTable.albumId,
            musicAlbumArtistsTable.artistId
          ],
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

const removeArtistFromAlbumEffect = (albumId: string, artistId: string) =>
  Effect.tryPromise({
    try: () =>
      db
        .delete(musicAlbumArtistsTable)
        .where(
          and(
            eq(musicAlbumArtistsTable.albumId, albumId),
            eq(musicAlbumArtistsTable.artistId, artistId)
          )
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

const addArtistToTrackEffect = (
  trackId: string,
  artistId: string,
  opts?: { role?: string; displayOrder?: number }
) =>
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
          target: [
            musicTrackArtistsTable.trackId,
            musicTrackArtistsTable.artistId
          ],
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

const removeArtistFromTrackEffect = (trackId: string, artistId: string) =>
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

// ---------------------------------------------------------------------------
// Link effects
// ---------------------------------------------------------------------------

const getLinksForEntityEffect = (
  entityType: MusicEntityType,
  entityId: string,
  statusFilter?: LinkStatus
) =>
  Effect.tryPromise({
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
  }).pipe(
    Effect.withSpan('musicEntity.getLinksForEntity', {
      attributes: { entityType, entityId }
    })
  )

const addLinkEffect = Effect.fn('musicEntity.addLink')(function* (
  data: InsertMusicEntityLink
) {
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
            status: data.status ?? 'pending_review',
            metadata: data.metadata,
            updatedAt: sql`now()`
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

const updateLinkStatusEffect = (
  entityType: MusicEntityType,
  entityId: string,
  linkId: string,
  status: LinkStatus,
  verifiedBy?: string,
  metadata?: Record<string, unknown>
) =>
  Effect.gen(function* () {
    const now = new Date()
    const updateData: Partial<typeof musicEntityLinksTable.$inferInsert> = {
      status,
      updatedAt: now
    }
    if (status === 'verified') {
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

const deleteLinkEffect = (
  entityType: MusicEntityType,
  entityId: string,
  linkId: string
) =>
  Effect.gen(function* () {
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

const getPendingLinksEffect = (opts?: { limit?: number; offset?: number }) =>
  Effect.tryPromise({
    try: () =>
      db
        .select()
        .from(musicEntityLinksTable)
        .where(eq(musicEntityLinksTable.status, 'pending_review'))
        .orderBy(desc(musicEntityLinksTable.scrapedAt))
        .limit(opts?.limit ?? 50)
        .offset(opts?.offset ?? 0),
    catch: (e) =>
      new DatabaseError({
        message: `Failed to get pending links: ${getErrorMessage(e)}`,
        operation: 'select',
        table: 'music_entity_links'
      })
  }).pipe(Effect.withSpan('musicEntity.getPendingLinks'))

// ---------------------------------------------------------------------------
// Scraping — runs providers, bulk-inserts all resulting links
// ---------------------------------------------------------------------------

const findArtistByNameCI = (name: string) =>
  Effect.tryPromise({
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
  }).pipe(Effect.withSpan('musicEntity.findArtistByNameCI'))

const findOrCreateArtist = Effect.fn('musicEntity.findOrCreateArtist')(
  function* (name: string, opts?: { imageUrl?: string | null }) {
    const rows = yield* findArtistByNameCI(name)
    if (rows[0]) {
      if (opts?.imageUrl && rows[0].imageUrl !== opts.imageUrl) {
        yield* Effect.logInfo(
          `[MusicEntity] Artist "${rows[0].name}" exists with different imageUrl (existing: ${rows[0].imageUrl}, scraped: ${opts.imageUrl}) — skipping update`
        )
      }
      return rows[0]
    }
    return yield* createArtistEffect({
      name,
      slug: toSlug(name),
      imageUrl: opts?.imageUrl
    })
  }
)

const findOrCreateArtistsByName = Effect.fn(
  'musicEntity.findOrCreateArtistsByName'
)(function* (names: string[]) {
  const artists: SelectMusicArtist[] = []
  for (const name of names) {
    artists.push(yield* findOrCreateArtist(name))
  }
  return artists
})

const findExistingEntityByUrl = (url: string, entityType: MusicEntityType) =>
  Effect.tryPromise({
    try: () =>
      db
        .select()
        .from(musicEntityLinksTable)
        .where(
          and(
            eq(musicEntityLinksTable.url, url),
            eq(musicEntityLinksTable.entityType, entityType)
          )
        )
        .limit(1),
    catch: (e) =>
      new DatabaseError({
        message: `Failed to check existing link: ${getErrorMessage(e)}`,
        operation: 'select',
        table: 'music_entity_links'
      })
  }).pipe(Effect.withSpan('musicEntity.findExistingEntityByUrl'))

const getEntityById = (
  entityType: MusicEntityType,
  entityId: string
): Effect.Effect<
  SelectMusicArtist | SelectMusicAlbum | SelectMusicTrack | SelectMusicPlaylist,
  DatabaseError | NotFoundError
> => {
  switch (entityType) {
    case 'artist':
      return getArtistByIdEffect(entityId)
    case 'album':
      return getAlbumByIdEffect(entityId)
    case 'track':
      return getTrackByIdEffect(entityId)
    case 'playlist':
      return getPlaylistByIdEffect(entityId)
  }
}

const scrapeAndCreateEntityEffect =
  (scraper: MusicLinkScraperService) =>
  (entityType: MusicEntityType, input: MusicScrapeInput) =>
    Effect.gen(function* () {
      if (input.url) {
        const existingLinks = yield* findExistingEntityByUrl(
          input.url,
          entityType
        )
        const match = existingLinks[0]
        if (match) {
          const entity = yield* Effect.catchTag(
            getEntityById(match.entityType as MusicEntityType, match.entityId),
            'NotFoundError',
            () => Effect.succeed(null)
          )
          if (entity) {
            const links = yield* getLinksForEntityEffect(
              match.entityType as MusicEntityType,
              match.entityId
            )
            yield* Effect.logInfo(
              `[MusicEntity] URL already scraped, returning existing ${match.entityType}:${match.entityId}`
            )
            return { entity, links }
          }
        }
      }

      const result = yield* scraper.scrape(input)
      const meta = result.entityMeta

      const rawArtistName = meta?.artistName ?? input.artistName
      const foundArtists =
        rawArtistName && (entityType === 'album' || entityType === 'track')
          ? yield* findOrCreateArtistsByName(parseArtistNames(rawArtistName))
          : undefined
      const artistNames = foundArtists?.map((a) => a.name)
      const artistIds = foundArtists?.map((a) => a.id)

      const entity = yield* (() => {
        switch (entityType) {
          case 'artist': {
            const name =
              meta?.artistName ?? input.artistName ?? 'Unknown Artist'
            return findOrCreateArtist(name, {
              imageUrl: meta?.thumbnailUrl
            })
          }
          case 'album': {
            const title = meta?.title ?? input.albumTitle ?? 'Untitled Album'
            return createAlbumEffect({
              title,
              slug: toSlug(title),
              artistNames,
              artistIds,
              coverImageUrl: meta?.thumbnailUrl
            })
          }
          case 'track': {
            const title = meta?.title ?? input.trackTitle ?? 'Untitled Track'
            return createTrackEffect({
              title,
              slug: toSlug(title),
              artistNames,
              artistIds,
              coverImageUrl: meta?.thumbnailUrl
            })
          }
          case 'playlist': {
            const title = meta?.title ?? 'Untitled Playlist'
            return createPlaylistEffect({
              title,
              slug: toSlug(title),
              coverImageUrl: meta?.thumbnailUrl
            })
          }
        }
      })()

      const entityId = entity.id
      const inserted: SelectMusicEntityLink[] = []
      for (const link of result.links) {
        const row = yield* Effect.catch(
          addLinkEffect({
            entityType,
            entityId,
            platform: link.platform,
            url: link.url,
            status: 'pending_review',
            scrapedAt: link.scrapedAt,
            metadata: link.metadata
          }),
          (e) =>
            Effect.andThen(
              Effect.logWarning(
                `Failed to persist scraped link ${link.platform}: ${e.message}`
              ),
              Effect.succeed(null as SelectMusicEntityLink | null)
            )
        )
        if (row) inserted.push(row)
      }

      yield* Effect.logInfo(
        `[MusicEntity] Scraped ${inserted.length} links for ${entityType}:${entityId}`
      )

      return { entity, links: inserted }
    }).pipe(
      Effect.withSpan('musicEntity.scrapeAndCreateEntity', {
        attributes: { entityType }
      })
    )

// ---------------------------------------------------------------------------
// Live layer
// ---------------------------------------------------------------------------

export const MusicEntityServiceLive = Layer.effect(
  MusicEntityService,
  Effect.gen(function* () {
    const scraper = yield* MusicLinkScraperServiceTag
    const spotify = yield* SpotifyServiceTag
    const s3 = yield* S3ServiceTag
    const config = yield* ConfigServiceTag

    return {
      createArtist: createArtistEffect,
      getArtists: getArtistsEffect,
      getArtistById: getArtistByIdEffect,
      updateArtist: updateArtistEffect,
      deleteArtist: deleteArtistEffect,

      createAlbum: createAlbumEffect,
      getAlbums: getAlbumsEffect,
      getAlbumById: getAlbumByIdEffect,
      updateAlbum: updateAlbumEffect,
      deleteAlbum: deleteAlbumEffect,

      createTrack: createTrackEffect,
      getTracks: getTracksEffect,
      getTrackById: getTrackByIdEffect,
      updateTrack: updateTrackEffect,
      deleteTrack: deleteTrackEffect,

      createPlaylist: createPlaylistEffect,
      getPlaylists: getPlaylistsEffect,
      getPlaylistById: getPlaylistByIdEffect,
      updatePlaylist: updatePlaylistEffect,
      deletePlaylist: deletePlaylistEffect,

      getPlaylistTracks: getPlaylistTracksEffect,
      addTrackToPlaylist: addTrackToPlaylistEffect,
      removeTrackFromPlaylist: removeTrackFromPlaylistEffect,
      reorderPlaylistTracks: reorderPlaylistTracksEffect,
      addSpotifyTrackToPlaylist: addSpotifyTrackToPlaylistEffect(spotify),
      importSpotifyPlaylist: importSpotifyPlaylistEffect(
        spotify,
        scraper,
        s3,
        config.urls.router,
        config.buckets.userContent
      ),
      syncPlaylistLinks: syncPlaylistLinksEffect(
        spotify,
        scraper,
        s3,
        config.urls.router,
        config.buckets.userContent
      ),

      addArtistToAlbum: addArtistToAlbumEffect,
      removeArtistFromAlbum: removeArtistFromAlbumEffect,
      addArtistToTrack: addArtistToTrackEffect,
      removeArtistFromTrack: removeArtistFromTrackEffect,

      getLinksForEntity: getLinksForEntityEffect,
      addLink: addLinkEffect,
      updateLinkStatus: updateLinkStatusEffect,
      deleteLink: deleteLinkEffect,
      getPendingLinks: getPendingLinksEffect,
      scrapeAndCreateEntity: scrapeAndCreateEntityEffect(scraper)
    } satisfies MusicEntityService
  })
)
