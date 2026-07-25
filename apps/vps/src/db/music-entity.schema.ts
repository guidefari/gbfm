import { LINK_STATUS, LINK_STATUSES } from '@gbfm/core/status'
import { z } from 'zod'
import { type InferInsertModel, type InferSelectModel, relations } from 'drizzle-orm'
import {
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
  varchar
} from 'drizzle-orm/pg-core'
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

// ---------------------------------------------------------------------------
// Seeded lookup tables
// ---------------------------------------------------------------------------

/** Seeded — do not insert manually; use scripts/seed-music-lookups.ts */
export const musicEntityTypesTable = pgTable('music_entity_types', {
  id: varchar({ length: 50 }).primaryKey(), // 'artist' | 'album' | 'track' | 'playlist' | 'label'
  displayName: varchar({ length: 100 }).notNull()
})

/** Seeded — do not insert manually; use scripts/seed-music-lookups.ts */
export const musicPlatformsTable = pgTable('music_platforms', {
  id: varchar({ length: 50 }).primaryKey(), // 'spotify' | 'bandcamp' | ...
  displayName: varchar({ length: 100 }).notNull(),
  websiteUrl: varchar({ length: 512 }),
  iconUrl: varchar({ length: 512 })
})

// ---------------------------------------------------------------------------
// Core entity tables
// ---------------------------------------------------------------------------

export const musicArtistsTable = pgTable(
  'music_artists',
  {
    id: uuid().primaryKey().defaultRandom(),
    name: varchar({ length: 255 }).notNull(),
    bio: text(),
    imageUrl: varchar({ length: 512 }),
    genres: varchar({ length: 255 }).array(),
    slug: varchar({ length: 255 }).notNull().unique(),
    publishedAt: timestamp({ withTimezone: true }),
    createdById: text().references(() => user.id, { onDelete: 'set null' }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow()
  },
  (table) => [index('music_artists_slug_idx').on(table.slug)]
)

export const musicAlbumsTable = pgTable(
  'music_albums',
  {
    id: uuid().primaryKey().defaultRandom(),
    title: varchar({ length: 255 }).notNull(),
    // Denormalized artist names for fast display without joins
    artistNames: varchar({ length: 255 }).array(),
    releaseDate: timestamp({ withTimezone: true }),
    coverImageUrl: varchar({ length: 512 }),
    genres: varchar({ length: 255 }).array(),
    albumType: varchar({ length: 50 }), // LP | EP | single | compilation
    slug: varchar({ length: 255 }).notNull().unique(),
    publishedAt: timestamp({ withTimezone: true }),
    createdById: text().references(() => user.id, { onDelete: 'set null' }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow()
  },
  (table) => [index('music_albums_slug_idx').on(table.slug)]
)

export const musicTracksTable = pgTable(
  'music_tracks',
  {
    id: uuid().primaryKey().defaultRandom(),
    title: varchar({ length: 255 }).notNull(),
    // Denormalized artist names for fast display without joins
    artistNames: varchar({ length: 255 }).array(),
    coverImageUrl: varchar({ length: 512 }),
    albumId: uuid().references(() => musicAlbumsTable.id, {
      onDelete: 'set null'
    }),
    trackNumber: integer(),
    slug: varchar({ length: 255 }).notNull().unique(),
    publishedAt: timestamp({ withTimezone: true }),
    createdById: text().references(() => user.id, { onDelete: 'set null' }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow()
  },
  (table) => [index('music_tracks_slug_idx').on(table.slug)]
)

export const musicPlaylistsTable = pgTable(
  'music_playlists',
  {
    id: uuid().primaryKey().defaultRandom(),
    title: varchar({ length: 255 }).notNull(),
    description: text(),
    coverImageUrl: varchar({ length: 512 }),
    curatorId: text().references(() => user.id, { onDelete: 'set null' }),
    slug: varchar({ length: 255 }).notNull().unique(),
    publishedAt: timestamp({ withTimezone: true }),
    createdById: text().references(() => user.id, { onDelete: 'set null' }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow()
  },
  (table) => [index('music_playlists_slug_idx').on(table.slug)]
)

export const musicLabelsTable = pgTable(
  'music_labels',
  {
    id: uuid().primaryKey().defaultRandom(),
    name: varchar({ length: 255 }).notNull(),
    description: text(),
    imageUrl: varchar('image_url', { length: 512 }),
    bannerImageUrl: varchar('banner_image_url', { length: 512 }),
    slug: varchar({ length: 255 }).notNull().unique(),
    content: text().notNull().default(''),
    tags: varchar({ length: 255 }).array(),
    genres: varchar({ length: 255 }).array(),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    createdById: text('created_by_id').references(() => user.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [index('music_labels_slug_idx').on(table.slug)]
)

export const musicLabelCreatorsTable = pgTable(
  'music_label_creators',
  {
    labelId: uuid('label_id')
      .notNull()
      .references(() => musicLabelsTable.id, { onDelete: 'cascade' }),
    creatorId: text('creator_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' })
  },
  (table) => [primaryKey({ columns: [table.labelId, table.creatorId] })]
)

// ---------------------------------------------------------------------------
// Many-to-many: artists ↔ albums and artists ↔ tracks
// ---------------------------------------------------------------------------

export const musicAlbumArtistsTable = pgTable(
  'music_album_artists',
  {
    albumId: uuid()
      .notNull()
      .references(() => musicAlbumsTable.id, { onDelete: 'cascade' }),
    artistId: uuid()
      .notNull()
      .references(() => musicArtistsTable.id, { onDelete: 'cascade' }),
    displayOrder: integer().notNull().default(0),
    role: varchar({ length: 100 }) // 'primary' | 'featured' | 'producer' | null
  },
  (table) => [primaryKey({ columns: [table.albumId, table.artistId] })]
)

export const musicTrackArtistsTable = pgTable(
  'music_track_artists',
  {
    trackId: uuid()
      .notNull()
      .references(() => musicTracksTable.id, { onDelete: 'cascade' }),
    artistId: uuid()
      .notNull()
      .references(() => musicArtistsTable.id, { onDelete: 'cascade' }),
    displayOrder: integer().notNull().default(0),
    role: varchar({ length: 100 })
  },
  (table) => [primaryKey({ columns: [table.trackId, table.artistId] })]
)

// ---------------------------------------------------------------------------
// Many-to-many: playlists ↔ tracks
// ---------------------------------------------------------------------------

export const musicPlaylistTracksTable = pgTable(
  'music_playlist_tracks',
  {
    playlistId: uuid()
      .notNull()
      .references(() => musicPlaylistsTable.id, { onDelete: 'cascade' }),
    trackId: uuid()
      .notNull()
      .references(() => musicTracksTable.id, { onDelete: 'cascade' }),
    position: integer().notNull(),
    addedAt: timestamp({ withTimezone: true }).notNull().defaultNow()
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
export const musicEntityLinksTable = pgTable(
  'music_entity_links',
  {
    id: uuid().primaryKey().defaultRandom(),
    // FK to music_entity_types — ensures only valid entity types are stored
    entityType: varchar({ length: 50 })
      .notNull()
      .references(() => musicEntityTypesTable.id),
    entityId: uuid().notNull(),
    // FK to music_platforms — ensures only known platforms are stored
    platform: varchar({ length: 50 })
      .notNull()
      .references(() => musicPlatformsTable.id),
    url: varchar({ length: 2048 }).notNull(),
    status: varchar({ length: 50 }).notNull().default(LINK_STATUS.PENDING_REVIEW),
    scrapedAt: timestamp({ withTimezone: true }),
    verifiedAt: timestamp({ withTimezone: true }),
    verifiedBy: text().references(() => user.id, { onDelete: 'set null' }),
    metadata: jsonb().$type<Record<string, unknown>>(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    index('music_entity_links_entity_idx').on(table.entityType, table.entityId),
    index('music_entity_links_status_idx').on(table.status),
    index('music_entity_links_platform_idx').on(table.platform),
    // One link per platform per entity
    unique('music_entity_links_unique_platform').on(
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

export type SelectMusicArtist = InferSelectModel<typeof musicArtistsTable>
export type InsertMusicArtist = InferInsertModel<typeof musicArtistsTable>

export type SelectMusicAlbum = InferSelectModel<typeof musicAlbumsTable>
export type InsertMusicAlbum = InferInsertModel<typeof musicAlbumsTable>

export type SelectMusicTrack = InferSelectModel<typeof musicTracksTable>
export type InsertMusicTrack = InferInsertModel<typeof musicTracksTable>

export type SelectMusicPlaylist = InferSelectModel<typeof musicPlaylistsTable>
export type InsertMusicPlaylist = InferInsertModel<typeof musicPlaylistsTable>

export type SelectMusicLabel = InferSelectModel<typeof musicLabelsTable>
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
  trackArtists: many(musicTrackArtistsTable)
}))

export const musicAlbumsRelations = relations(musicAlbumsTable, ({ many }) => ({
  albumArtists: many(musicAlbumArtistsTable),
  tracks: many(musicTracksTable)
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
  creators: many(musicLabelCreatorsTable)
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

export const insertMusicEntityLinkSchema = z.object({
  entityType: entityTypeEnum,
  entityId: z.string().uuid(),
  platform: musicPlatformEnum,
  url: z.string().url(),
  status: linkStatusEnum.optional().default(LINK_STATUS.PENDING_REVIEW),
  scrapedAt: z.coerce.date().optional(),
  metadata: z.record(z.string(), z.unknown()).optional()
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
  metadata: z.record(z.string(), z.unknown()).nullable(),
  createdAt: z.date(),
  updatedAt: z.date()
})

export const updateMusicEntityLinkStatusSchema = z.object({
  status: linkStatusEnum,
  metadata: z.record(z.string(), z.unknown()).optional()
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
