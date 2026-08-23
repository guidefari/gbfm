import { LINK_STATUS } from '@gbfm/core/status'
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

export const musicEntityResolutionClaimsTable = sqliteTable(
  'music_entity_resolution_claims',
  {
    entityType: text('entity_type')
      .notNull()
      .references(() => musicEntityTypesTable.id),
    canonicalUrl: text('canonical_url').notNull(),
    entityId: text('entity_id'),
    ownerToken: text('owner_token'),
    leaseExpiresAt: integer('lease_expires_at', { mode: 'timestamp_ms' }),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date())
  },
  (table) => [primaryKey({ columns: [table.entityType, table.canonicalUrl] })]
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
export type SelectMusicEntityResolutionClaim = InferSelectModel<
  typeof musicEntityResolutionClaimsTable
>

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
