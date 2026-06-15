import { z } from '@hono/zod-openapi'
import { type InferInsertModel, type InferSelectModel, relations } from 'drizzle-orm'
import { index, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core'
import { user } from './auth.schema'

export const newsletterSubscribersTable = pgTable(
  'newsletter_subscribers',
  {
    id: uuid().primaryKey().defaultRandom(),
    email: varchar({ length: 255 }).notNull().unique(),
    name: varchar({ length: 100 }),
    source: varchar({ length: 50 }),
    userId: text().references(() => user.id, { onDelete: 'set null' }),
    unsubscribeToken: uuid().unique().defaultRandom(),
    unsubscribedAt: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    index('newsletter_subscribers_email_idx').on(table.email),
    index('newsletter_subscribers_userId_idx').on(table.userId)
  ]
)

export const newsletterSubscribersRelations = relations(newsletterSubscribersTable, ({ one }) => ({
  user: one(user, {
    fields: [newsletterSubscribersTable.userId],
    references: [user.id]
  })
}))

export type SelectNewsletterSubscriber = InferSelectModel<typeof newsletterSubscribersTable>
export type InsertNewsletterSubscriber = InferInsertModel<typeof newsletterSubscribersTable>

export const insertNewsletterSubscriberSchema = z.object({
  email: z.string().email(),
  name: z.string().max(100).optional(),
  source: z.string().optional()
})

export const subscribeResponseSchema = z.object({
  subscribed: z.boolean(),
  email: z.string().email()
})

export const unsubscribeSchema = z.object({
  token: z.string().uuid()
})

export const unsubscribeResponseSchema = z.object({
  success: z.boolean()
})

export const requestUnsubscribeSchema = z.object({
  email: z.string().email()
})

export const requestUnsubscribeResponseSchema = z.object({
  sent: z.boolean()
})
