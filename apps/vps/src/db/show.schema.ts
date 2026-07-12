import { z } from 'zod'
import { type InferInsertModel, type InferSelectModel, relations } from 'drizzle-orm'
import { index, pgTable, primaryKey, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core'
import { user } from './auth.schema'
import { defaultContentFields } from './util'

export const showsTable = pgTable(
  'shows',
  {
    ...defaultContentFields
  },
  (table) => [index('shows_slug_idx').on(table.slug)]
)

export type SelectShow = InferSelectModel<typeof showsTable>
export type InsertShow = InferInsertModel<typeof showsTable>

export type SelectMdxCompiledShow = SelectShow & {
  compiledContent: string
  hosts?: Array<{
    id: string
    name: string
  }>
}

export const showCreators = pgTable(
  'show_creators',
  {
    showId: uuid()
      .notNull()
      .references(() => showsTable.id, { onDelete: 'cascade' }),
    creatorId: text()
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' })
  },
  (t) => [primaryKey({ columns: [t.showId, t.creatorId] })]
)

export const showSubscriptionsTable = pgTable(
  'show_subscriptions',
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    showId: uuid()
      .notNull()
      .references(() => showsTable.id, { onDelete: 'cascade' }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow()
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

export const selectShowSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  thumbnailUrl: z.string().nullable(),
  bannerImageUrl: z.string().nullable(),
  slug: z.string(),
  content: z.string(),
  draft: z.boolean(),
  tags: z.array(z.string()).nullable(),
  createdAt: z.date(),
  updatedAt: z.date()
})

export const selectMdxCompiledShowSchema = selectShowSchema.extend({
  compiledContent: z.string(),
  hosts: z
    .array(
      z.object({
        id: z.string(),
        name: z.string()
      })
    )
    .optional()
})

export const insertShowSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  thumbnailUrl: z.string().optional(),
  bannerImageUrl: z.string().optional(),
  slug: z.string().min(1),
  content: z.string(),
  draft: z.boolean().optional(),
  tags: z.array(z.string()).optional()
})

export const createShowSchema = insertShowSchema.extend({
  hostIds: z.array(z.string()).min(1).optional()
})

export const updateShowSchema = insertShowSchema.partial().extend({
  hostIds: z.array(z.string()).optional()
})

export const selectSubscriptionSchema = z.object({
  id: z.string(),
  userId: z.string(),
  showId: z.string(),
  createdAt: z.date()
})

export const subscriptionWithShowSchema = selectSubscriptionSchema.extend({
  show: selectShowSchema
})
