import { index, integer, primaryKey, sqliteTable, text, unique } from 'drizzle-orm/sqlite-core'

import { user } from './auth.schema'

/** External saves are owned by listeners, independent of the GBFM audio catalog. */
export const savedMixesTable = sqliteTable(
  'saved_mixes',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    url: text('url').notNull(),
    platform: text('platform', {
      enum: ['youtube', 'spotify', 'soundcloud', 'mixcloud'],
    }).notNull(),
    embedUrl: text('embed_url'),
    title: text('title').notNull(),
    notes: text('notes').notNull().default(''),
    status: text('status', { enum: ['to-listen', 'listening', 'listened'] })
      .notNull()
      .default('to-listen'),
    published: integer('published', { mode: 'boolean' }).notNull().default(false),
    createdAt: integer('created_at')
      .notNull()
      .$defaultFn(() => Date.now()),
  },
  (t) => [
    unique('saved_mixes_owner_url').on(t.userId, t.url),
    index('saved_mixes_owner').on(t.userId),
  ],
)

/** Collection visibility never overrides an individual mix's private state. */
export const listeningCollectionsTable = sqliteTable(
  'listening_collections',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    description: text('description').notNull().default(''),
    published: integer('published', { mode: 'boolean' }).notNull().default(false),
    createdAt: integer('created_at')
      .notNull()
      .$defaultFn(() => Date.now()),
  },
  (t) => [index('listening_collections_owner').on(t.userId)],
)

/** Many collections can reference the same saved mix and its single notes field. */
export const listeningMembershipsTable = sqliteTable(
  'listening_memberships',
  {
    collectionId: text('collection_id')
      .notNull()
      .references(() => listeningCollectionsTable.id, { onDelete: 'cascade' }),
    mixId: text('mix_id')
      .notNull()
      .references(() => savedMixesTable.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.collectionId, t.mixId] })],
)
