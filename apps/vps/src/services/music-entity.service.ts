import { and, desc, eq, sql } from 'drizzle-orm'
import { Context, Effect, Layer } from 'effect'
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
  musicTrackArtistsTable,
  musicTracksTable,
  type SelectMusicAlbum,
  type SelectMusicArtist,
  type SelectMusicEntityLink,
  type SelectMusicPlaylist,
  type SelectMusicTrack
} from '@/db/music-entity.schema'
import { DatabaseError, getErrorMessage, NotFoundError } from '@/errors'
import {
  type MusicLinkScraperService,
  MusicLinkScraperService as MusicLinkScraperServiceTag,
  type MusicScrapeInput
} from './music-link-scraper.service'

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
    SelectMusicPlaylist[],
    DatabaseError
  >
  readonly getPlaylistById: (
    id: string
  ) => Effect.Effect<SelectMusicPlaylist, DatabaseError | NotFoundError>
  readonly updatePlaylist: (
    id: string,
    data: Partial<CreatePlaylistInput>
  ) => Effect.Effect<SelectMusicPlaylist, DatabaseError | NotFoundError>
  readonly deletePlaylist: (
    id: string
  ) => Effect.Effect<void, DatabaseError | NotFoundError>

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
  Context.GenericTag<MusicEntityService>('MusicEntityService')

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

/** Insert junction rows (artist → album or artist → track). Ignores conflicts. */
function insertArtistLinks(
  table: typeof musicAlbumArtistsTable | typeof musicTrackArtistsTable,
  entityKey: 'albumId' | 'trackId',
  entityId: string,
  artistIds: string[]
): Effect.Effect<void, DatabaseError> {
  if (artistIds.length === 0) return Effect.void
  const rows = artistIds.map((artistId, i) => ({
    [entityKey]: entityId,
    artistId,
    displayOrder: i
  }))
  return Effect.tryPromise({
    try: () =>
      (db.insert(table) as ReturnType<typeof db.insert>)
        .values(rows)
        .onConflictDoNothing(),
    catch: (e) =>
      new DatabaseError({
        message: `Failed to link artists: ${getErrorMessage(e)}`,
        operation: 'insert',
        table: table._.name
      })
  }).pipe(Effect.asVoid)
}

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
    const rows = yield* Effect.tryPromise({
      try: () =>
        db
          .update(musicArtistsTable)
          .set({ ...data, updatedAt: new Date() })
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
        db
          .delete(musicArtistsTable)
          .where(eq(musicArtistsTable.id, id))
          .returning({ id: musicArtistsTable.id }),
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
  const rows = yield* Effect.tryPromise({
    try: () => db.insert(musicAlbumsTable).values(albumData).returning(),
    catch: (e) =>
      new DatabaseError({
        message: `Failed to create album: ${getErrorMessage(e)}`,
        operation: 'insert',
        table: 'music_albums'
      })
  })
  const album = yield* requireInserted(rows, 'music_albums')

  if (artistIds?.length) {
    yield* insertArtistLinks(
      musicAlbumArtistsTable,
      'albumId',
      album.id,
      artistIds
    )
  }

  return album
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
    const rows = yield* Effect.tryPromise({
      try: () =>
        db
          .update(musicAlbumsTable)
          .set({ ...albumData, updatedAt: new Date() })
          .where(eq(musicAlbumsTable.id, id))
          .returning(),
      catch: (e) =>
        new DatabaseError({
          message: `Failed to update album: ${getErrorMessage(e)}`,
          operation: 'update',
          table: 'music_albums'
        })
    })
    const album = yield* requireOne(rows, 'MusicAlbum', id)

    if (artistIds?.length) {
      yield* insertArtistLinks(musicAlbumArtistsTable, 'albumId', id, artistIds)
    }

    return album
  }).pipe(Effect.withSpan('musicEntity.updateAlbum', { attributes: { id } }))

const deleteAlbumEffect = (id: string) =>
  Effect.gen(function* () {
    const rows = yield* Effect.tryPromise({
      try: () =>
        db
          .delete(musicAlbumsTable)
          .where(eq(musicAlbumsTable.id, id))
          .returning({ id: musicAlbumsTable.id }),
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
  const rows = yield* Effect.tryPromise({
    try: () => db.insert(musicTracksTable).values(trackData).returning(),
    catch: (e) =>
      new DatabaseError({
        message: `Failed to create track: ${getErrorMessage(e)}`,
        operation: 'insert',
        table: 'music_tracks'
      })
  })
  const track = yield* requireInserted(rows, 'music_tracks')

  if (artistIds?.length) {
    yield* insertArtistLinks(
      musicTrackArtistsTable,
      'trackId',
      track.id,
      artistIds
    )
  }

  return track
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
    const rows = yield* Effect.tryPromise({
      try: () =>
        db
          .update(musicTracksTable)
          .set({ ...trackData, updatedAt: new Date() })
          .where(eq(musicTracksTable.id, id))
          .returning(),
      catch: (e) =>
        new DatabaseError({
          message: `Failed to update track: ${getErrorMessage(e)}`,
          operation: 'update',
          table: 'music_tracks'
        })
    })
    const track = yield* requireOne(rows, 'MusicTrack', id)

    if (artistIds?.length) {
      yield* insertArtistLinks(musicTrackArtistsTable, 'trackId', id, artistIds)
    }

    return track
  }).pipe(Effect.withSpan('musicEntity.updateTrack', { attributes: { id } }))

const deleteTrackEffect = (id: string) =>
  Effect.gen(function* () {
    const rows = yield* Effect.tryPromise({
      try: () =>
        db
          .delete(musicTracksTable)
          .where(eq(musicTracksTable.id, id))
          .returning({ id: musicTracksTable.id }),
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
    try: () =>
      db
        .select()
        .from(musicPlaylistsTable)
        .orderBy(desc(musicPlaylistsTable.createdAt)),
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
      try: () =>
        db
          .select()
          .from(musicPlaylistsTable)
          .where(eq(musicPlaylistsTable.id, id))
          .limit(1),
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
    const rows = yield* Effect.tryPromise({
      try: () =>
        db
          .update(musicPlaylistsTable)
          .set({ ...data, updatedAt: new Date() })
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
        db
          .delete(musicPlaylistsTable)
          .where(eq(musicPlaylistsTable.id, id))
          .returning({ id: musicPlaylistsTable.id }),
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

const toSlug = (text: string) =>
  `${text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')}-${crypto.randomUUID().slice(0, 8)}`

const scrapeAndCreateEntityEffect =
  (scraper: MusicLinkScraperService) =>
  (entityType: MusicEntityType, input: MusicScrapeInput) =>
    Effect.gen(function* () {
      const result = yield* scraper.scrape(input)
      const meta = result.entityMeta

      const entity = yield* (() => {
        switch (entityType) {
          case 'artist': {
            const name =
              meta?.artistName ?? input.artistName ?? 'Unknown Artist'
            return createArtistEffect({
              name,
              slug: toSlug(name),
              imageUrl: meta?.thumbnailUrl
            })
          }
          case 'album': {
            const title = meta?.title ?? input.albumTitle ?? 'Untitled Album'
            const artistName = meta?.artistName ?? input.artistName
            return createAlbumEffect({
              title,
              slug: toSlug(title),
              artistNames: artistName ? [artistName] : undefined,
              coverImageUrl: meta?.thumbnailUrl
            })
          }
          case 'track': {
            const title = meta?.title ?? input.trackTitle ?? 'Untitled Track'
            const artistName = meta?.artistName ?? input.artistName
            return createTrackEffect({
              title,
              slug: toSlug(title),
              artistNames: artistName ? [artistName] : undefined
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
        const row = yield* Effect.catchAll(
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
            Effect.zipRight(
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
