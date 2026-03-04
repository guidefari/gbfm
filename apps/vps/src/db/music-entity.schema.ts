import { z } from '@hono/zod-openapi'
import {
  type InferInsertModel,
  type InferSelectModel,
  relations
} from 'drizzle-orm'
import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
  varchar
} from 'drizzle-orm/pg-core'
import { user } from './auth.schema'

// ---------------------------------------------------------------------------
// Constants (no pgEnum per project conventions)
// ---------------------------------------------------------------------------

export const MUSIC_ENTITY_TYPES = [
  'artist',
  'album',
  'track',
  'playlist'
] as const
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
  'other'
] as const
export type MusicPlatform = (typeof MUSIC_PLATFORMS)[number]

export const LINK_STATUSES = [
  'pending_review',
  'verified',
  'rejected'
] as const
export type LinkStatus = (typeof LINK_STATUSES)[number]

export const ALBUM_TYPES = ['LP', 'EP', 'single', 'compilation'] as const
export type AlbumType = (typeof ALBUM_TYPES)[number]

// ---------------------------------------------------------------------------
// Tables
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
    // Denormalized artist names for display without joins
    artistNames: varchar({ length: 255 }).array(),
    // Optional FK to primary artist
    artistId: uuid().references(() => musicArtistsTable.id, {
      onDelete: 'set null'
    }),
    releaseDate: timestamp({ withTimezone: true }),
    coverImageUrl: varchar({ length: 512 }),
    genres: varchar({ length: 255 }).array(),
    albumType: varchar({ length: 50 }), // LP | EP | single | compilation
    slug: varchar({ length: 255 }).notNull().unique(),
    publishedAt: timestamp({ withTimezone: true }),
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
    artistNames: varchar({ length: 255 }).array(),
    artistId: uuid().references(() => musicArtistsTable.id, {
      onDelete: 'set null'
    }),
    albumId: uuid().references(() => musicAlbumsTable.id, {
      onDelete: 'set null'
    }),
    duration: integer(), // seconds
    trackNumber: integer(),
    slug: varchar({ length: 255 }).notNull().unique(),
    publishedAt: timestamp({ withTimezone: true }),
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
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow()
  },
  (table) => [index('music_playlists_slug_idx').on(table.slug)]
)

/**
 * Platform-agnostic links for any music entity.
 * This is the core of the system — each entity (artist, album, track, playlist)
 * can have multiple links across streaming platforms, social media, etc.
 */
export const musicEntityLinksTable = pgTable(
  'music_entity_links',
  {
    id: uuid().primaryKey().defaultRandom(),
    // Polymorphic reference (no FK constraint to keep it flexible)
    entityType: varchar({ length: 50 }).notNull(), // artist | album | track | playlist
    entityId: uuid().notNull(),
    platform: varchar({ length: 50 }).notNull(), // spotify | youtube | bandcamp | ...
    url: varchar({ length: 2048 }).notNull(),
    status: varchar({ length: 50 }).notNull().default('pending_review'),
    scrapedAt: timestamp({ withTimezone: true }),
    verifiedAt: timestamp({ withTimezone: true }),
    verifiedBy: text().references(() => user.id, { onDelete: 'set null' }),
    // Extra platform-specific metadata (e.g. Spotify ID, follower count snapshot)
    metadata: jsonb().$type<Record<string, unknown>>(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    index('music_entity_links_entity_idx').on(table.entityType, table.entityId),
    index('music_entity_links_status_idx').on(table.status),
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

export type SelectMusicArtist = InferSelectModel<typeof musicArtistsTable>
export type InsertMusicArtist = InferInsertModel<typeof musicArtistsTable>

export type SelectMusicAlbum = InferSelectModel<typeof musicAlbumsTable>
export type InsertMusicAlbum = InferInsertModel<typeof musicAlbumsTable>

export type SelectMusicTrack = InferSelectModel<typeof musicTracksTable>
export type InsertMusicTrack = InferInsertModel<typeof musicTracksTable>

export type SelectMusicPlaylist = InferSelectModel<typeof musicPlaylistsTable>
export type InsertMusicPlaylist = InferInsertModel<typeof musicPlaylistsTable>

export type SelectMusicEntityLink = InferSelectModel<
  typeof musicEntityLinksTable
>
export type InsertMusicEntityLink = InferInsertModel<
  typeof musicEntityLinksTable
>

// ---------------------------------------------------------------------------
// Drizzle relations
// ---------------------------------------------------------------------------

export const musicArtistsRelations = relations(
  musicArtistsTable,
  ({ many }) => ({
    albums: many(musicAlbumsTable),
    tracks: many(musicTracksTable)
  })
)

export const musicAlbumsRelations = relations(
  musicAlbumsTable,
  ({ one, many }) => ({
    artist: one(musicArtistsTable, {
      fields: [musicAlbumsTable.artistId],
      references: [musicArtistsTable.id]
    }),
    tracks: many(musicTracksTable)
  })
)

export const musicTracksRelations = relations(musicTracksTable, ({ one }) => ({
  artist: one(musicArtistsTable, {
    fields: [musicTracksTable.artistId],
    references: [musicArtistsTable.id]
  }),
  album: one(musicAlbumsTable, {
    fields: [musicTracksTable.albumId],
    references: [musicAlbumsTable.id]
  })
}))

export const musicPlaylistsRelations = relations(
  musicPlaylistsTable,
  ({ one }) => ({
    curator: one(user, {
      fields: [musicPlaylistsTable.curatorId],
      references: [user.id]
    })
  })
)

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

const musicPlatformEnum = z.enum(MUSIC_PLATFORMS).openapi('MusicPlatform')
const linkStatusEnum = z.enum(LINK_STATUSES).openapi('LinkStatus')
const entityTypeEnum = z.enum(MUSIC_ENTITY_TYPES).openapi('MusicEntityType')

// --- Artist ---

export const insertMusicArtistSchema = z
  .object({
    name: z.string().min(1).openapi({ example: 'Burial' }),
    bio: z.string().optional(),
    imageUrl: z.string().url().optional(),
    genres: z.array(z.string()).optional(),
    slug: z.string().min(1).openapi({ example: 'burial' }),
    publishedAt: z.coerce.date().optional()
  })
  .openapi('InsertMusicArtist')

export const selectMusicArtistSchema = z
  .object({
    id: z.string().uuid(),
    name: z.string(),
    bio: z.string().nullable(),
    imageUrl: z.string().nullable(),
    genres: z.array(z.string()).nullable(),
    slug: z.string(),
    publishedAt: z.date().nullable(),
    createdAt: z.date(),
    updatedAt: z.date()
  })
  .openapi('MusicArtist')

export const updateMusicArtistSchema = insertMusicArtistSchema
  .partial()
  .openapi('UpdateMusicArtist')

// --- Album ---

export const insertMusicAlbumSchema = z
  .object({
    title: z.string().min(1).openapi({ example: 'Untrue' }),
    artistNames: z.array(z.string()).optional(),
    artistId: z.string().uuid().optional(),
    releaseDate: z.coerce.date().optional(),
    coverImageUrl: z.string().url().optional(),
    genres: z.array(z.string()).optional(),
    albumType: z
      .enum(['LP', 'EP', 'single', 'compilation'])
      .optional()
      .openapi({ example: 'LP' }),
    slug: z.string().min(1).openapi({ example: 'untrue' }),
    publishedAt: z.coerce.date().optional()
  })
  .openapi('InsertMusicAlbum')

export const selectMusicAlbumSchema = z
  .object({
    id: z.string().uuid(),
    title: z.string(),
    artistNames: z.array(z.string()).nullable(),
    artistId: z.string().nullable(),
    releaseDate: z.date().nullable(),
    coverImageUrl: z.string().nullable(),
    genres: z.array(z.string()).nullable(),
    albumType: z.string().nullable(),
    slug: z.string(),
    publishedAt: z.date().nullable(),
    createdAt: z.date(),
    updatedAt: z.date()
  })
  .openapi('MusicAlbum')

export const updateMusicAlbumSchema = insertMusicAlbumSchema
  .partial()
  .openapi('UpdateMusicAlbum')

// --- Track ---

export const insertMusicTrackSchema = z
  .object({
    title: z.string().min(1).openapi({ example: 'Archangel' }),
    artistNames: z.array(z.string()).optional(),
    artistId: z.string().uuid().optional(),
    albumId: z.string().uuid().optional(),
    duration: z.number().int().positive().optional().openapi({ example: 303 }),
    trackNumber: z.number().int().positive().optional(),
    slug: z.string().min(1).openapi({ example: 'archangel' }),
    publishedAt: z.coerce.date().optional()
  })
  .openapi('InsertMusicTrack')

export const selectMusicTrackSchema = z
  .object({
    id: z.string().uuid(),
    title: z.string(),
    artistNames: z.array(z.string()).nullable(),
    artistId: z.string().nullable(),
    albumId: z.string().nullable(),
    duration: z.number().nullable(),
    trackNumber: z.number().nullable(),
    slug: z.string(),
    publishedAt: z.date().nullable(),
    createdAt: z.date(),
    updatedAt: z.date()
  })
  .openapi('MusicTrack')

export const updateMusicTrackSchema = insertMusicTrackSchema
  .partial()
  .openapi('UpdateMusicTrack')

// --- Playlist ---

export const insertMusicPlaylistSchema = z
  .object({
    title: z.string().min(1).openapi({ example: 'Late Night Selections' }),
    description: z.string().optional(),
    coverImageUrl: z.string().url().optional(),
    curatorId: z.string().optional(),
    slug: z.string().min(1).openapi({ example: 'late-night-selections' }),
    publishedAt: z.coerce.date().optional()
  })
  .openapi('InsertMusicPlaylist')

export const selectMusicPlaylistSchema = z
  .object({
    id: z.string().uuid(),
    title: z.string(),
    description: z.string().nullable(),
    coverImageUrl: z.string().nullable(),
    curatorId: z.string().nullable(),
    slug: z.string(),
    publishedAt: z.date().nullable(),
    createdAt: z.date(),
    updatedAt: z.date()
  })
  .openapi('MusicPlaylist')

export const updateMusicPlaylistSchema = insertMusicPlaylistSchema
  .partial()
  .openapi('UpdateMusicPlaylist')

// --- Entity Link ---
// Note: entityType/platform use z.string() in the select schema because
// Drizzle types varchar columns as plain string. Enum validation is enforced
// on inputs only.

export const insertMusicEntityLinkSchema = z
  .object({
    entityType: entityTypeEnum,
    entityId: z.string().uuid(),
    platform: musicPlatformEnum,
    url: z.string().url(),
    status: linkStatusEnum.optional().default('pending_review'),
    scrapedAt: z.coerce.date().optional(),
    metadata: z.record(z.string(), z.unknown()).optional()
  })
  .openapi('InsertMusicEntityLink')

export const selectMusicEntityLinkSchema = z
  .object({
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
  .openapi('MusicEntityLink')

export const updateMusicEntityLinkStatusSchema = z
  .object({
    status: linkStatusEnum,
    metadata: z.record(z.string(), z.unknown()).optional()
  })
  .openapi('UpdateMusicEntityLinkStatus')

// Re-export enums for use in routes
export { musicPlatformEnum, linkStatusEnum, entityTypeEnum }
