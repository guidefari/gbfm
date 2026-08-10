import { sql } from 'drizzle-orm'
import { integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'
import { user } from './auth.schema'
import { postsTable } from './post.schema'

export const navigationSessions = sqliteTable(
  'navigation_sessions',
  {
    id: text('id')
      .$defaultFn(() => crypto.randomUUID())
      .primaryKey(),
    userId: text('userId').references(() => user.id, { onDelete: 'cascade' }),
    deviceToken: text('deviceToken'),
    cursor: integer('cursor').notNull().default(0),
    lastIntentToken: text('lastIntentToken'),
    createdAt: integer('createdAt', { mode: 'timestamp_ms' })
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: integer('updatedAt', { mode: 'timestamp_ms' })
      .$defaultFn(() => new Date())
      .notNull()
  },
  (table) => [
    uniqueIndex('navigation_sessions_user_uq')
      .on(table.userId)
      .where(sql`${table.userId} IS NOT NULL`),
    uniqueIndex('navigation_sessions_device_uq')
      .on(table.deviceToken)
      .where(sql`${table.deviceToken} IS NOT NULL`)
  ]
)

export const navigationSeenPosts = sqliteTable(
  'navigation_seen_posts',
  {
    sessionId: text('sessionId')
      .notNull()
      .references(() => navigationSessions.id, { onDelete: 'cascade' }),
    slug: text('slug').notNull()
  },
  (table) => [uniqueIndex('navigation_seen_session_slug_uq').on(table.sessionId, table.slug)]
)

export const navigationTrailEntries = sqliteTable(
  'navigation_trail_entries',
  {
    id: text('id')
      .$defaultFn(() => crypto.randomUUID())
      .primaryKey(),
    sessionId: text('sessionId')
      .notNull()
      .references(() => navigationSessions.id, { onDelete: 'cascade' }),
    postId: text('postId')
      .notNull()
      .references(() => postsTable.id, { onDelete: 'cascade' }),
    slug: text('slug').notNull(),
    position: integer('position').notNull(),
    arrivedBy: text('arrivedBy').notNull(),
    visitedAt: integer('visitedAt', { mode: 'timestamp_ms' })
      .$defaultFn(() => new Date())
      .notNull()
  },
  (table) => [
    uniqueIndex('navigation_trail_session_position_uq').on(table.sessionId, table.position)
  ]
)
