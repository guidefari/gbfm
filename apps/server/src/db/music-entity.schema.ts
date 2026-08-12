import { LINK_STATUS, LINK_STATUSES } from '@gbfm/core/status'
import { z } from 'zod'
import { type InferInsertModel, type InferSelectModel, relations } from 'drizzle-orm'
import { index, integer, primaryKey, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'
import { user } from './auth.schema'

// ---------------------------------------------------------------------------
// Design note: entity types and platforms as seeded lookup tables
//
// Instead of TypeScript-only enums, we maintain two small reference tables
// (`music_entity_types` and `music_platforms`) that are populated by a seed
// script (`scripts/seed-music-lookups.ts`). This gives us:
//   • FK constraints at the DB level (invalid values are rejected by Postgres)
//   • Metadata on each platform/type (display name, icon, website)
//   • Admin-UI visibility into what's supported without reading TS source
//   • Same index performance for WHERE platform = 'spotify' queries — the FK
//     does not change how Postgres indexes or scans the varchar column; the
//     index on music_entity_links(platform) is what matters for search speed
//
// Adding a new platform = insert a row into music_platforms + add to the TS
// constant below so app-level type safety stays in sync.
// ---------------------------------------------------------------------------

export const MUSIC_ENTITY_TYPES = ['artist', 'album', 'track', 'playlist', 'label'] as const
export type MusicEntityType = (typeof MUSIC_ENTITY_TYPES)[number]

export const MUSIC_PLATFORMS = [
  'spotify',
  'youtube',
  'youtube_music',
  'apple_music',
  'bandcamp',
  'soundcloud',
  'tidal',
  'deezer',
  'amazon_music',
  'discord',
  'website',
  'instagram',
  'twitter',
  'musicbrainz',
  'discogs',
  'other'
] as const
export type MusicPlatform = (typeof MUSIC_PLATFORMS)[number]

export const ALBUM_TYPES = ['LP', 'EP', 'single', 'compilation'] as const
export type AlbumType = (typeof ALBUM_TYPES)[number]

export type MusicEntityMetadataValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | ReadonlyArray<MusicEntityMetadataValue>
  | { readonly [key: string]: MusicEntityMetadataValue }
export type MusicEntityMetadata = Record<string, MusicEntityMetadataValue>

// ---------------------------------------------------------------------------
// Seeded lookup tables
// ---------------------------------------------------------------------------

/** Seeded — do not insert manually; use scripts/seed-music-lookups.ts */
export const musicEntityTypesTable = sqliteTable('music_entity_types', {
  id: text().primaryKey(), // 'artist' | 'album' | 'track' | 'playlist' | 'label'
  displayName: text().notNull()
})

/** Seeded — do not insert manually; use scripts/seed-music-lookups.ts */
export const musicPlatformsTable = sqliteTable('music_platforms', {
  id: text().primaryKey(), // 'spotify' | 'bandcamp' | ...
  displayName: text().notNull(),
  websiteUrl: text(),
  iconUrl: text()
})

// ---------------------------------------------------------------------------
// Core entity tables
// ---------------------------------------------------------------------------

export const musicArtistsTable = sqliteTable(
  'music_artists',
  {
    id: text()
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    name: text().notNull(),
    bio: text(),
    imageUrl: text(),
    slug: text().notNull().unique(),
    publishedAt: integer({ mode: 'timestamp_ms' }),
    createdById: text().references(() => user.id, { onDelete: 'set null' }),
    createdAt: integer({ mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer({ mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date())
  },
  (table) => [index('music_artists_slug_idx').on(table.slug)]
)

export const musicAlbumsTable = sqliteTable(
  'music_albums',
  {
    id: text()
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    title: text().notNull(),
    // Denormalized artist names for fast display without joins
    artistNames: text({ mode: 'json' }).$type<string[]>(),
    releaseDate: integer({ mode: 'timestamp_ms' }),
    coverImageUrl: text(),
    albumType: text(), // LP | EP | single | compilation
    slug: text().notNull().unique(),
    publishedAt: integer({ mode: 'timestamp_ms' }),
    createdById: text().references(() => user.id, { onDelete: 'set null' }),
    createdAt: integer({ mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer({ mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date())
  },
  (table) => [index('music_albums_slug_idx').on(table.slug)]
)

export const musicTracksTable = sqliteTable(
  'music_tracks',
  {
    id: text()
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    title: text().notNull(),
    // Denormalized artist names for fast display without joins
    artistNames: text({ mode: 'json' }).$type<string[]>(),
    coverImageUrl: text(),
    albumId: text().references(() => musicAlbumsTable.id, {
      onDelete: 'set null'
    }),
    trackNumber: integer(),
    slug: text().notNull().unique(),
    publishedAt: integer({ mode: 'timestamp_ms' }),
    createdById: text().references(() => user.id, { onDelete: 'set null' }),
    createdAt: integer({ mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer({ mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date())
  },
  (table) => [index('music_tracks_slug_idx').on(table.slug)]
)

export const musicPlaylistsTable = sqliteTable(
  'music_playlists',
  {
    id: text()
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    title: text().notNull(),
    description: text(),
    coverImageUrl: text(),
    curatorId: text().references(() => user.id, { onDelete: 'set null' }),
    slug: text().notNull().unique(),
    publishedAt: integer({ mode: 'timestamp_ms' }),
    createdById: text().references(() => user.id, { onDelete: 'set null' }),
    createdAt: integer({ mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer({ mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date()),
    revision: integer().notNull().default(0)
  },
  (table) => [index('music_playlists_slug_idx').on(table.slug)]
)

export const musicLabelsTable = sqliteTable(
  'music_labels',
  {
    id: text()
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    name: text().notNull(),
    description: text(),
    imageUrl: text('image_url'),
    bannerImageUrl: text('banner_image_url'),
    slug: text().notNull().unique(),
    content: text().notNull().default(''),
    publishedAt: integer('published_at', { mode: 'timestamp_ms' }),
    createdById: text('created_by_id').references(() => user.id, { onDelete: 'set null' }),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date())
  },
  (table) => [index('music_labels_slug_idx').on(table.slug)]
)

export const musicLabelCreatorsTable = sqliteTable(
  'music_label_creators',
  {
    labelId: text('label_id')
      .notNull()
      .references(() => musicLabelsTable.id, { onDelete: 'cascade' }),
    creatorId: text('creator_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' })
  },
  (table) => [primaryKey({ columns: [table.labelId, table.creatorId] })]
)

export const musicLabelArtistsTable = sqliteTable(
  'music_label_artists',
  {
    labelId: text('label_id')
      .notNull()
      .references(() => musicLabelsTable.id, { onDelete: 'cascade' }),
    artistId: text('artist_id')
      .notNull()
      .references(() => musicArtistsTable.id, { onDelete: 'cascade' })
  },
  (table) => [
    primaryKey({ columns: [table.labelId, table.artistId] }),
    index('music_label_artists_artist_id_idx').on(table.artistId)
  ]
)

export const musicLabelAlbumsTable = sqliteTable(
  'music_label_albums',
  {
    labelId: text('label_id')
      .notNull()
      .references(() => musicLabelsTable.id, { onDelete: 'cascade' }),
    albumId: text('album_id')
      .notNull()
      .references(() => musicAlbumsTable.id, { onDelete: 'cascade' })
  },
  (table) => [
    primaryKey({ columns: [table.labelId, table.albumId] }),
    index('music_label_albums_album_id_idx').on(table.albumId)
  ]
)

// ---------------------------------------------------------------------------
// Many-to-many: artists ↔ albums and artists ↔ tracks
// ---------------------------------------------------------------------------

export const musicAlbumArtistsTable = sqliteTable(
  'music_album_artists',
  {
    albumId: text()
      .notNull()
      .references(() => musicAlbumsTable.id, { onDelete: 'cascade' }),
    artistId: text()
      .notNull()
      .references(() => musicArtistsTable.id, { onDelete: 'cascade' }),
    displayOrder: integer().notNull().default(0),
    role: text() // 'primary' | 'featured' | 'producer' | null
  },
  (table) => [primaryKey({ columns: [table.albumId, table.artistId] })]
)

export const musicTrackArtistsTable = sqliteTable(
  'music_track_artists',
  {
    trackId: text()
      .notNull()
      .references(() => musicTracksTable.id, { onDelete: 'cascade' }),
    artistId: text()
      .notNull()
      .references(() => musicArtistsTable.id, { onDelete: 'cascade' }),
    displayOrder: integer().notNull().default(0),
    role: text()
  },
  (table) => [primaryKey({ columns: [table.trackId, table.artistId] })]
)

// ---------------------------------------------------------------------------
// Many-to-many: playlists ↔ tracks
// ---------------------------------------------------------------------------

export const musicPlaylistTracksTable = sqliteTable(
  'music_playlist_tracks',
  {
    playlistId: text()
      .notNull()
      .references(() => musicPlaylistsTable.id, { onDelete: 'cascade' }),
    trackId: text()
      .notNull()
      .references(() => musicTracksTable.id, { onDelete: 'cascade' }),
    position: integer().notNull(),
    addedAt: integer({ mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date())
  },
  (table) => [
    primaryKey({ columns: [table.playlistId, table.trackId] }),
    index('music_playlist_tracks_position_idx').on(table.playlistId, table.position)
  ]
)

// ---------------------------------------------------------------------------
// Platform links — the core of the agnostic storage
// ---------------------------------------------------------------------------

/**
 * Each music entity (artist, album, track, playlist, label) can have many links,
 * one per platform. Both `entityType` and `platform` are FK-constrained to
 * their respective seeded lookup tables so invalid values are rejected at the
 * database level.
 */
export const musicEntityLinksTable = sqliteTable(
  'music_entity_links',
  {
    id: text()
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    // FK to music_entity_types — ensures only valid entity types are stored
    entityType: text('entity_type')
      .notNull()
      .references(() => musicEntityTypesTable.id),
    entityId: text().notNull(),
    // FK to music_platforms — ensures only known platforms are stored
    platform: text()
      .notNull()
      .references(() => musicPlatformsTable.id),
    url: text().notNull(),
    status: text().notNull().default(LINK_STATUS.VERIFIED),
    scrapedAt: integer({ mode: 'timestamp_ms' }),
    verifiedAt: integer({ mode: 'timestamp_ms' }),
    verifiedBy: text().references(() => user.id, { onDelete: 'set null' }),
    metadata: text({ mode: 'json' }).$type<MusicEntityMetadata>(),
    createdAt: integer({ mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer({ mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date())
  },
  (table) => [
    index('music_entity_links_entity_idx').on(table.entityType, table.entityId),
    index('music_entity_links_status_idx').on(table.status),
    index('music_entity_links_platform_idx').on(table.platform),
    uniqueIndex('music_entity_links_identity_uq').on(
      table.entityType,
      table.entityId,
      table.platform
    )
  ]
)

// ---------------------------------------------------------------------------
// TypeScript types
// ---------------------------------------------------------------------------

export type SelectMusicEntityType = InferSelectModel<typeof musicEntityTypesTable>
export type SelectMusicPlatform = InferSelectModel<typeof musicPlatformsTable>

export type SelectMusicArtist = InferSelectModel<typeof musicArtistsTable> & {
  genres: string[] | null
}
export type InsertMusicArtist = InferInsertModel<typeof musicArtistsTable>

export type SelectMusicAlbum = InferSelectModel<typeof musicAlbumsTable> & {
  genres: string[] | null
}
export type InsertMusicAlbum = InferInsertModel<typeof musicAlbumsTable>

export type SelectMusicTrack = InferSelectModel<typeof musicTracksTable>
export type InsertMusicTrack = InferInsertModel<typeof musicTracksTable>

export type SelectMusicPlaylist = InferSelectModel<typeof musicPlaylistsTable>
export type InsertMusicPlaylist = InferInsertModel<typeof musicPlaylistsTable>

export type SelectMusicLabel = InferSelectModel<typeof musicLabelsTable> & {
  tags: string[] | null
  genres: string[] | null
}
export type InsertMusicLabel = InferInsertModel<typeof musicLabelsTable>
export type SelectMdxCompiledMusicLabel = SelectMusicLabel & {
  compiledContent: string
  creators: Array<{ id: string; name: string }>
}

export type SelectMusicPlaylistTrack = InferSelectModel<typeof musicPlaylistTracksTable>
export type InsertMusicPlaylistTrack = InferInsertModel<typeof musicPlaylistTracksTable>

export type SelectMusicEntityLink = InferSelectModel<typeof musicEntityLinksTable>
export type InsertMusicEntityLink = InferInsertModel<typeof musicEntityLinksTable>

// ---------------------------------------------------------------------------
// Drizzle relations
// ---------------------------------------------------------------------------

export const musicArtistsRelations = relations(musicArtistsTable, ({ many }) => ({
  albumArtists: many(musicAlbumArtistsTable),
  trackArtists: many(musicTrackArtistsTable),
  labelArtists: many(musicLabelArtistsTable)
}))

export const musicAlbumsRelations = relations(musicAlbumsTable, ({ many }) => ({
  albumArtists: many(musicAlbumArtistsTable),
  tracks: many(musicTracksTable),
  labelAlbums: many(musicLabelAlbumsTable)
}))

export const musicTracksRelations = relations(musicTracksTable, ({ one, many }) => ({
  album: one(musicAlbumsTable, {
    fields: [musicTracksTable.albumId],
    references: [musicAlbumsTable.id]
  }),
  trackArtists: many(musicTrackArtistsTable),
  playlistTracks: many(musicPlaylistTracksTable)
}))

export const musicAlbumArtistsRelations = relations(musicAlbumArtistsTable, ({ one }) => ({
  album: one(musicAlbumsTable, {
    fields: [musicAlbumArtistsTable.albumId],
    references: [musicAlbumsTable.id]
  }),
  artist: one(musicArtistsTable, {
    fields: [musicAlbumArtistsTable.artistId],
    references: [musicArtistsTable.id]
  })
}))

export const musicTrackArtistsRelations = relations(musicTrackArtistsTable, ({ one }) => ({
  track: one(musicTracksTable, {
    fields: [musicTrackArtistsTable.trackId],
    references: [musicTracksTable.id]
  }),
  artist: one(musicArtistsTable, {
    fields: [musicTrackArtistsTable.artistId],
    references: [musicArtistsTable.id]
  })
}))

export const musicPlaylistsRelations = relations(musicPlaylistsTable, ({ one, many }) => ({
  curator: one(user, {
    fields: [musicPlaylistsTable.curatorId],
    references: [user.id]
  }),
  playlistTracks: many(musicPlaylistTracksTable)
}))

export const musicLabelsRelations = relations(musicLabelsTable, ({ many }) => ({
  creators: many(musicLabelCreatorsTable),
  artists: many(musicLabelArtistsTable),
  albums: many(musicLabelAlbumsTable)
}))

export const musicLabelCreatorsRelations = relations(musicLabelCreatorsTable, ({ one }) => ({
  label: one(musicLabelsTable, {
    fields: [musicLabelCreatorsTable.labelId],
    references: [musicLabelsTable.id]
  }),
  creator: one(user, {
    fields: [musicLabelCreatorsTable.creatorId],
    references: [user.id]
  })
}))

export const musicLabelArtistsRelations = relations(musicLabelArtistsTable, ({ one }) => ({
  label: one(musicLabelsTable, {
    fields: [musicLabelArtistsTable.labelId],
    references: [musicLabelsTable.id]
  }),
  artist: one(musicArtistsTable, {
    fields: [musicLabelArtistsTable.artistId],
    references: [musicArtistsTable.id]
  })
}))

export const musicLabelAlbumsRelations = relations(musicLabelAlbumsTable, ({ one }) => ({
  label: one(musicLabelsTable, {
    fields: [musicLabelAlbumsTable.labelId],
    references: [musicLabelsTable.id]
  }),
  album: one(musicAlbumsTable, {
    fields: [musicLabelAlbumsTable.albumId],
    references: [musicAlbumsTable.id]
  })
}))

export const musicPlaylistTracksRelations = relations(musicPlaylistTracksTable, ({ one }) => ({
  playlist: one(musicPlaylistsTable, {
    fields: [musicPlaylistTracksTable.playlistId],
    references: [musicPlaylistsTable.id]
  }),
  track: one(musicTracksTable, {
    fields: [musicPlaylistTracksTable.trackId],
    references: [musicTracksTable.id]
  })
}))

// ---------------------------------------------------------------------------
// Zod schemas for API validation
// ---------------------------------------------------------------------------

const musicPlatformEnum = z.enum(MUSIC_PLATFORMS)

const linkStatusEnum = z.enum(LINK_STATUSES)

const entityTypeEnum = z.enum(MUSIC_ENTITY_TYPES)

// --- Artist ---

export const insertMusicArtistSchema = z.object({
  name: z.string().min(1),
  bio: z.string().optional(),
  imageUrl: z.string().url().optional(),
  genres: z.array(z.string()).optional(),
  slug: z.string().min(1),
  publishedAt: z.coerce.date().optional()
})

export const selectMusicArtistSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  bio: z.string().nullable(),
  imageUrl: z.string().nullable(),
  genres: z.array(z.string()).nullable(),
  slug: z.string(),
  publishedAt: z.date().nullable(),
  createdById: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date()
})

export const updateMusicArtistSchema = insertMusicArtistSchema.partial()

// --- Album ---

export const insertMusicAlbumSchema = z.object({
  title: z.string().min(1),
  artistNames: z.array(z.string()).optional(),
  artistIds: z.array(z.string().uuid()).optional(),
  releaseDate: z.coerce.date().optional(),
  coverImageUrl: z.string().url().optional(),
  genres: z.array(z.string()).optional(),
  albumType: z.enum(['LP', 'EP', 'single', 'compilation']).optional(),
  slug: z.string().min(1),
  publishedAt: z.coerce.date().optional()
})

export const selectMusicAlbumSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  artistNames: z.array(z.string()).nullable(),
  releaseDate: z.date().nullable(),
  coverImageUrl: z.string().nullable(),
  genres: z.array(z.string()).nullable(),
  albumType: z.string().nullable(),
  slug: z.string(),
  publishedAt: z.date().nullable(),
  createdById: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date()
})

export const updateMusicAlbumSchema = insertMusicAlbumSchema.partial()

// --- Track ---

export const insertMusicTrackSchema = z.object({
  title: z.string().min(1),
  artistNames: z.array(z.string()).optional(),
  artistIds: z.array(z.string().uuid()).optional(),
  coverImageUrl: z.string().url().optional(),
  albumId: z.string().uuid().optional(),
  trackNumber: z.number().int().positive().optional(),
  slug: z.string().min(1),
  publishedAt: z.coerce.date().optional()
})

export const selectMusicTrackSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  artistNames: z.array(z.string()).nullable(),
  coverImageUrl: z.string().nullable(),
  albumId: z.string().nullable(),
  trackNumber: z.number().nullable(),
  slug: z.string(),
  publishedAt: z.date().nullable(),
  createdById: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date()
})

export const updateMusicTrackSchema = insertMusicTrackSchema.partial()

// --- Playlist ---

export const insertMusicPlaylistSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  coverImageUrl: z.string().url().optional(),
  curatorId: z.string().optional(),
  slug: z.string().min(1),
  publishedAt: z.coerce.date().optional()
})

export const selectMusicPlaylistSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  description: z.string().nullable(),
  coverImageUrl: z.string().nullable(),
  curatorId: z.string().nullable(),
  slug: z.string(),
  publishedAt: z.date().nullable(),
  createdById: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
  spotifyUrl: z.string().nullable().optional()
})

export const updateMusicPlaylistSchema = insertMusicPlaylistSchema.partial()

export const insertMusicLabelSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  imageUrl: z.string().url().optional(),
  bannerImageUrl: z.string().url().optional(),
  slug: z.string().min(1),
  content: z.string(),
  tags: z.array(z.string()).optional(),
  genres: z.array(z.string()).optional(),
  publishedAt: z.coerce.date().optional()
})

export const selectMusicLabelSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  imageUrl: z.string().nullable(),
  bannerImageUrl: z.string().nullable(),
  slug: z.string(),
  content: z.string(),
  tags: z.array(z.string()).nullable(),
  genres: z.array(z.string()).nullable(),
  publishedAt: z.date().nullable(),
  createdById: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date()
})

export const updateMusicLabelSchema = insertMusicLabelSchema.partial()

// --- Entity Link ---
// entityType/platform use z.string() in the select schema because
// Drizzle types varchar FK columns as plain string; enum validation is
// enforced on inputs only.

export const musicEntityMetadataSchema = z.record(z.string(), z.json())

export const insertMusicEntityLinkSchema = z.object({
  entityType: entityTypeEnum,
  entityId: z.string().uuid(),
  platform: musicPlatformEnum,
  url: z.string().url(),
  status: linkStatusEnum.optional().default(LINK_STATUS.VERIFIED),
  scrapedAt: z.coerce.date().optional(),
  metadata: musicEntityMetadataSchema.optional()
})

export const selectMusicEntityLinkSchema = z.object({
  id: z.string().uuid(),
  entityType: z.string(),
  entityId: z.string().uuid(),
  platform: z.string(),
  url: z.string(),
  status: z.string(),
  scrapedAt: z.date().nullable(),
  verifiedAt: z.date().nullable(),
  verifiedBy: z.string().nullable(),
  metadata: musicEntityMetadataSchema.nullable(),
  createdAt: z.date(),
  updatedAt: z.date()
})

export const updateMusicEntityLinkStatusSchema = z.object({
  status: linkStatusEnum,
  metadata: musicEntityMetadataSchema.optional()
})

// --- Artist junction schemas ---

export const musicAlbumArtistSchema = z.object({
  albumId: z.string().uuid(),
  artistId: z.string().uuid(),
  displayOrder: z.number().int().default(0),
  role: z.string().optional()
})

export const musicTrackArtistSchema = z.object({
  trackId: z.string().uuid(),
  artistId: z.string().uuid(),
  displayOrder: z.number().int().default(0),
  role: z.string().optional()
})

// --- Playlist track junction schemas ---

export const musicPlaylistTrackSchema = z.object({
  playlistId: z.string().uuid(),
  trackId: z.string().uuid(),
  position: z.number().int().nonnegative(),
  addedAt: z.date()
})

export const insertMusicPlaylistTrackSchema = z.object({
  trackId: z.string().uuid(),
  position: z.number().int().nonnegative()
})

export const reorderPlaylistTracksSchema = z.object({
  trackIds: z.array(z.string().uuid()).min(1)
})

export const addSpotifyTrackToPlaylistSchema = z.object({
  url: z.string().url()
})

export const addSpotifyTrackResultSchema = z.object({
  trackId: z.string().uuid(),
  position: z.number().int(),
  created: z.boolean()
})

export const importSpotifyPlaylistSchema = z.object({
  url: z.string().url()
})

export const importSpotifyPlaylistResultSchema = z.object({
  playlist: selectMusicPlaylistSchema,
  trackCount: z.number().int(),
  createdTrackCount: z.number().int(),
  reusedTrackCount: z.number().int()
})

export const importSpotifyPlaylistQueuedSchema = z.object({
  status: z.literal('Queued')
})

// Re-export enums for use in routes
export { entityTypeEnum, linkStatusEnum, musicPlatformEnum }
