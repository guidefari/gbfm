import { type InferInsertModel, type InferSelectModel, relations } from 'drizzle-orm'
import { index, integer, primaryKey, sqliteTable, text, unique } from 'drizzle-orm/sqlite-core'
import { user } from './auth.schema'
import { defaultContentFields } from './util'

export const showsTable = sqliteTable(
  'shows',
  {
    ...defaultContentFields
  },
  (table) => [index('shows_slug_idx').on(table.slug)]
)

export type SelectShow = InferSelectModel<typeof showsTable> & { tags: string[] | null }
export type InsertShow = InferInsertModel<typeof showsTable> & { tags?: string[] }

export type SelectMdxCompiledShow = SelectShow & {
  compiledContent: string
  hosts?: Array<{
    id: string
    name: string
  }>
}

export const showCreators = sqliteTable(
  'show_creators',
  {
    showId: text()
      .notNull()
      .references(() => showsTable.id, { onDelete: 'cascade' }),
    creatorId: text()
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' })
  },
  (t) => [
    primaryKey({ columns: [t.showId, t.creatorId] }),
    index('show_creators_creatorId_idx').on(t.creatorId)
  ]
)

export const showSubscriptionsTable = sqliteTable(
  'show_subscriptions',
  {
    id: text()
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    showId: text()
      .notNull()
      .references(() => showsTable.id, { onDelete: 'cascade' }),
    createdAt: integer({ mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date())
  },
  (table) => [
    unique('show_subscriptions_user_show_unique').on(table.userId, table.showId),
    index('show_subscriptions_user_idx').on(table.userId),
    index('show_subscriptions_show_idx').on(table.showId)
  ]
)

export type SelectShowSubscription = InferSelectModel<typeof showSubscriptionsTable>
export type InsertShowSubscription = InferInsertModel<typeof showSubscriptionsTable>

export const showsRelations = relations(showsTable, ({ many }) => ({
  showCreators: many(showCreators),
  subscriptions: many(showSubscriptionsTable)
}))

export const showCreatorsRelations = relations(showCreators, ({ one }) => ({
  show: one(showsTable, {
    fields: [showCreators.showId],
    references: [showsTable.id]
  }),
  creator: one(user, {
    fields: [showCreators.creatorId],
    references: [user.id]
  })
}))

export const showSubscriptionsRelations = relations(showSubscriptionsTable, ({ one }) => ({
  user: one(user, {
    fields: [showSubscriptionsTable.userId],
    references: [user.id]
  }),
  show: one(showsTable, {
    fields: [showSubscriptionsTable.showId],
    references: [showsTable.id]
  })
}))
