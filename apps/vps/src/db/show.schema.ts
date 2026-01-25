import { z } from '@hono/zod-openapi'
import {
  type InferInsertModel,
  type InferSelectModel,
  relations
} from 'drizzle-orm'
import {
  index,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core'
import { user } from './auth.schema'
import { defaultContentFields } from './util'


export const showsTable = pgTable(
  'shows',
  {
    ...defaultContentFields,
  },
  (table) => [
    index('shows_slug_idx').on(table.slug)
  ]
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

export type SelectShowSubscription = InferSelectModel<
  typeof showSubscriptionsTable
>
export type InsertShowSubscription = InferInsertModel<
  typeof showSubscriptionsTable
>

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

export const showSubscriptionsRelations = relations(
  showSubscriptionsTable,
  ({ one }) => ({
    user: one(user, {
      fields: [showSubscriptionsTable.userId],
      references: [user.id]
    }),
    show: one(showsTable, {
      fields: [showSubscriptionsTable.showId],
      references: [showsTable.id]
    })
  })
)

export const selectShowSchema = z
  .object({
    id: z.string().openapi({ description: 'Unique identifier for the show' }),
    title: z.string().openapi({ description: 'Title of the show' }),
    description: z
      .string()
      .nullable()
      .openapi({ description: 'Description of the show' }),
    thumbnailUrl: z
      .string()
      .nullable()
      .openapi({ description: 'Thumbnail URL for the show' }),
    slug: z.string().openapi({ description: 'URL slug for the show' }),
    content: z.string().openapi({ description: 'Content of the show' }),
    draft: z.boolean().openapi({ description: 'Whether the show is a draft' }),
    tags: z
      .array(z.string())
      .nullable()
      .openapi({ description: 'Tags associated with the show' }),
    createdAt: z.date().openapi({ description: 'Creation timestamp' }),
    updatedAt: z.date().openapi({ description: 'Last update timestamp' })
  })
  .openapi('Show')

export const selectMdxCompiledShowSchema = selectShowSchema
  .extend({
    compiledContent: z
      .string()
      .openapi({ description: 'Compiled MDX content' }),
    hosts: z
      .array(
        z
          .object({
            id: z.string().openapi({ description: 'Host ID' }),
            name: z.string().openapi({ description: 'Host name' })
          })
          .openapi('ShowHost')
      )
      .optional()
      .openapi({ description: 'List of hosts for this show' })
  })
  .openapi('CompiledShow')

export const insertShowSchema = z
  .object({
    title: z
      .string()
      .min(1)
      .openapi({ description: 'Title of the show', example: 'Friday Sessions' }),
    description: z
      .string()
      .optional()
      .openapi({ description: 'Description of the show' }),
    thumbnailUrl: z
      .string()
      .optional()
      .openapi({ description: 'Thumbnail URL for the show' }),
    slug: z.string().min(1).openapi({
      description: 'URL slug for the show',
      example: 'friday-sessions'
    }),
    content: z.string().openapi({ description: 'Content of the show' }),
    draft: z
      .boolean()
      .optional()
      .openapi({ description: 'Whether this is a draft', default: false }),
    tags: z
      .array(z.string())
      .optional()
      .openapi({ description: 'Tags for the show' }),
  })
  .openapi('InsertShow')

export const createShowSchema = insertShowSchema
  .extend({
    hostIds: z
      .array(z.string())
      .min(1)
      .optional()
      .openapi({ description: 'IDs of show hosts' })
  })
  .openapi('CreateShowRequest')

export const updateShowSchema = insertShowSchema
  .partial()
  .openapi('UpdateShowRequest')

export const selectSubscriptionSchema = z
  .object({
    id: z
      .string()
      .openapi({ description: 'Unique identifier for the subscription' }),
    userId: z.string().openapi({ description: 'ID of the subscribed user' }),
    showId: z.string().openapi({ description: 'ID of the show' }),
    createdAt: z.date().openapi({ description: 'Subscription timestamp' })
  })
  .openapi('ShowSubscription')

export const subscriptionWithShowSchema = selectSubscriptionSchema
  .extend({
    show: selectShowSchema.openapi({ description: 'The subscribed show' })
  })
  .openapi('SubscriptionWithShow')
