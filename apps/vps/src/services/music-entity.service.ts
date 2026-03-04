import { and, desc, eq, sql } from 'drizzle-orm'
import { Context, Effect, Layer } from 'effect'
import { db } from '@/db'
import {
  type InsertMusicAlbum,
  type InsertMusicArtist,
  type InsertMusicEntityLink,
  type InsertMusicPlaylist,
  type InsertMusicTrack,
  LINK_STATUSES,
  type LinkStatus,
  type MusicEntityType,
  musicAlbumsTable,
  musicArtistsTable,
  musicEntityLinksTable,
  musicPlaylistsTable,
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
  type ScrapedLink
} from './music-link-scraper.service'

// ---------------------------------------------------------------------------
// Service interface
// ---------------------------------------------------------------------------

export interface MusicEntityService {
  // Artists
  readonly createArtist: (
    data: InsertMusicArtist
  ) => Effect.Effect<SelectMusicArtist, DatabaseError>
  readonly getArtists: () => Effect.Effect<SelectMusicArtist[], DatabaseError>
  readonly getArtistById: (
    id: string
  ) => Effect.Effect<SelectMusicArtist, DatabaseError | NotFoundError>
  readonly updateArtist: (
    id: string,
    data: Partial<InsertMusicArtist>
  ) => Effect.Effect<SelectMusicArtist, DatabaseError | NotFoundError>
  readonly deleteArtist: (
    id: string
  ) => Effect.Effect<void, DatabaseError | NotFoundError>

  // Albums
  readonly createAlbum: (
    data: InsertMusicAlbum
  ) => Effect.Effect<SelectMusicAlbum, DatabaseError>
  readonly getAlbums: () => Effect.Effect<SelectMusicAlbum[], DatabaseError>
  readonly getAlbumById: (
    id: string
  ) => Effect.Effect<SelectMusicAlbum, DatabaseError | NotFoundError>
  readonly updateAlbum: (
    id: string,
    data: Partial<InsertMusicAlbum>
  ) => Effect.Effect<SelectMusicAlbum, DatabaseError | NotFoundError>
  readonly deleteAlbum: (
    id: string
  ) => Effect.Effect<void, DatabaseError | NotFoundError>

  // Tracks
  readonly createTrack: (
    data: InsertMusicTrack
  ) => Effect.Effect<SelectMusicTrack, DatabaseError>
  readonly getTracks: () => Effect.Effect<SelectMusicTrack[], DatabaseError>
  readonly getTrackById: (
    id: string
  ) => Effect.Effect<SelectMusicTrack, DatabaseError | NotFoundError>
  readonly updateTrack: (
    id: string,
    data: Partial<InsertMusicTrack>
  ) => Effect.Effect<SelectMusicTrack, DatabaseError | NotFoundError>
  readonly deleteTrack: (
    id: string
  ) => Effect.Effect<void, DatabaseError | NotFoundError>

  // Playlists
  readonly createPlaylist: (
    data: InsertMusicPlaylist
  ) => Effect.Effect<SelectMusicPlaylist, DatabaseError>
  readonly getPlaylists: () => Effect.Effect<SelectMusicPlaylist[], DatabaseError>
  readonly getPlaylistById: (
    id: string
  ) => Effect.Effect<SelectMusicPlaylist, DatabaseError | NotFoundError>
  readonly updatePlaylist: (
    id: string,
    data: Partial<InsertMusicPlaylist>
  ) => Effect.Effect<SelectMusicPlaylist, DatabaseError | NotFoundError>
  readonly deletePlaylist: (
    id: string
  ) => Effect.Effect<void, DatabaseError | NotFoundError>

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
    linkId: string,
    status: LinkStatus,
    verifiedBy?: string,
    metadata?: Record<string, unknown>
  ) => Effect.Effect<SelectMusicEntityLink, DatabaseError | NotFoundError>
  readonly deleteLink: (
    linkId: string
  ) => Effect.Effect<void, DatabaseError | NotFoundError>
  readonly getPendingLinks: (opts?: {
    limit?: number
    offset?: number
  }) => Effect.Effect<SelectMusicEntityLink[], DatabaseError>

  // Scraping
  readonly scrapeLinksForEntity: (
    entityType: MusicEntityType,
    entityId: string,
    seedUrl: string
  ) => Effect.Effect<SelectMusicEntityLink[], DatabaseError>
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
        message: `Insert returned no rows`,
        operation: 'insert',
        table
      })
    )
  }
  return Effect.succeed(row)
}

// ---------------------------------------------------------------------------
// Artist effects
// ---------------------------------------------------------------------------

const createArtistEffect = (data: InsertMusicArtist) =>
  Effect.gen(function* () {
    const rows = yield* Effect.tryPromise({
      try: () =>
        db.insert(musicArtistsTable).values(data).returning(),
      catch: (e) =>
        new DatabaseError({
          message: `Failed to create artist: ${getErrorMessage(e)}`,
          operation: 'insert',
          table: 'music_artists'
        })
    })
    return yield* requireInserted(rows, 'music_artists')
  }).pipe(Effect.withSpan('musicEntity.createArtist'))

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

const updateArtistEffect = (id: string, data: Partial<InsertMusicArtist>) =>
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

const createAlbumEffect = (data: InsertMusicAlbum) =>
  Effect.gen(function* () {
    const rows = yield* Effect.tryPromise({
      try: () => db.insert(musicAlbumsTable).values(data).returning(),
      catch: (e) =>
        new DatabaseError({
          message: `Failed to create album: ${getErrorMessage(e)}`,
          operation: 'insert',
          table: 'music_albums'
        })
    })
    return yield* requireInserted(rows, 'music_albums')
  }).pipe(Effect.withSpan('musicEntity.createAlbum'))

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

const updateAlbumEffect = (id: string, data: Partial<InsertMusicAlbum>) =>
  Effect.gen(function* () {
    const rows = yield* Effect.tryPromise({
      try: () =>
        db
          .update(musicAlbumsTable)
          .set({ ...data, updatedAt: new Date() })
          .where(eq(musicAlbumsTable.id, id))
          .returning(),
      catch: (e) =>
        new DatabaseError({
          message: `Failed to update album: ${getErrorMessage(e)}`,
          operation: 'update',
          table: 'music_albums'
        })
    })
    return yield* requireOne(rows, 'MusicAlbum', id)
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

const createTrackEffect = (data: InsertMusicTrack) =>
  Effect.gen(function* () {
    const rows = yield* Effect.tryPromise({
      try: () => db.insert(musicTracksTable).values(data).returning(),
      catch: (e) =>
        new DatabaseError({
          message: `Failed to create track: ${getErrorMessage(e)}`,
          operation: 'insert',
          table: 'music_tracks'
        })
    })
    return yield* requireInserted(rows, 'music_tracks')
  }).pipe(Effect.withSpan('musicEntity.createTrack'))

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

const updateTrackEffect = (id: string, data: Partial<InsertMusicTrack>) =>
  Effect.gen(function* () {
    const rows = yield* Effect.tryPromise({
      try: () =>
        db
          .update(musicTracksTable)
          .set({ ...data, updatedAt: new Date() })
          .where(eq(musicTracksTable.id, id))
          .returning(),
      catch: (e) =>
        new DatabaseError({
          message: `Failed to update track: ${getErrorMessage(e)}`,
          operation: 'update',
          table: 'music_tracks'
        })
    })
    return yield* requireOne(rows, 'MusicTrack', id)
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

const createPlaylistEffect = (data: InsertMusicPlaylist) =>
  Effect.gen(function* () {
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
  }).pipe(Effect.withSpan('musicEntity.createPlaylist'))

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

const updatePlaylistEffect = (id: string, data: Partial<InsertMusicPlaylist>) =>
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
  }).pipe(
    Effect.withSpan('musicEntity.updatePlaylist', { attributes: { id } })
  )

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
  }).pipe(
    Effect.withSpan('musicEntity.deletePlaylist', { attributes: { id } })
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

const addLinkEffect = (data: InsertMusicEntityLink) =>
  Effect.gen(function* () {
    const rows = yield* Effect.tryPromise({
      // ON CONFLICT: update URL + metadata if the same platform link is re-added
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
  }).pipe(Effect.withSpan('musicEntity.addLink'))

const updateLinkStatusEffect = (
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
          .where(eq(musicEntityLinksTable.id, linkId))
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
      attributes: { linkId, status }
    })
  )

const deleteLinkEffect = (linkId: string) =>
  Effect.gen(function* () {
    const rows = yield* Effect.tryPromise({
      try: () =>
        db
          .delete(musicEntityLinksTable)
          .where(eq(musicEntityLinksTable.id, linkId))
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
    Effect.withSpan('musicEntity.deleteLink', { attributes: { linkId } })
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
// Scraping effect — calls scraper service then bulk-inserts results
// ---------------------------------------------------------------------------

const scrapeLinksEffect =
  (scraper: MusicLinkScraperService) =>
  (entityType: MusicEntityType, entityId: string, seedUrl: string) =>
    Effect.gen(function* () {
      const result = yield* Effect.catchAll(
        scraper.scrapeFromUrl(seedUrl),
        (err) =>
          Effect.zipRight(
            Effect.logWarning(`Scrape failed for ${seedUrl}: ${err.message}`),
            Effect.succeed({ links: [] as ScrapedLink[], entityMeta: undefined })
          )
      )

      if (result.links.length === 0) {
        return [] as SelectMusicEntityLink[]
      }

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

      return inserted
    }).pipe(
      Effect.withSpan('musicEntity.scrapeLinks', {
        attributes: { entityType, entityId, seedUrl }
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

      getLinksForEntity: getLinksForEntityEffect,
      addLink: addLinkEffect,
      updateLinkStatus: updateLinkStatusEffect,
      deleteLink: deleteLinkEffect,
      getPendingLinks: getPendingLinksEffect,
      scrapeLinksForEntity: scrapeLinksEffect(scraper)
    } satisfies MusicEntityService
  })
)
