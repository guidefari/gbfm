import { sql } from 'drizzle-orm'
import { integer, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import { user } from './auth.schema'
import { postsTable } from './post.schema'

export const navigationSessions = pgTable(
  'navigation_sessions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: text('userId').references(() => user.id, { onDelete: 'cascade' }),
    deviceToken: text('deviceToken'),
    cursor: integer('cursor').notNull().default(0),
    createdAt: timestamp('createdAt').defaultNow().notNull(),
    updatedAt: timestamp('updatedAt').defaultNow().notNull()
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

export const navigationTrailEntries = pgTable(
  'navigation_trail_entries',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    sessionId: uuid('sessionId')
      .notNull()
      .references(() => navigationSessions.id, { onDelete: 'cascade' }),
    postId: uuid('postId')
      .notNull()
      .references(() => postsTable.id, { onDelete: 'cascade' }),
    slug: text('slug').notNull(),
    position: integer('position').notNull(),
    arrivedBy: text('arrivedBy').notNull(),
    visitedAt: timestamp('visitedAt').defaultNow().notNull()
  },
  (table) => [
    uniqueIndex('navigation_trail_session_position_uq').on(table.sessionId, table.position)
  ]
)
