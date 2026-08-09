import { z } from 'zod'
import { type InferInsertModel, type InferSelectModel, relations } from 'drizzle-orm'
import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { user } from './auth.schema'

export const newsletterSubscribersTable = sqliteTable(
  'newsletter_subscribers',
  {
    id: text()
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    email: text().notNull().unique(),
    name: text(),
    source: text(),
    userId: text().references(() => user.id, { onDelete: 'set null' }),
    unsubscribeToken: text()
      .unique()
      .$defaultFn(() => crypto.randomUUID()),
    unsubscribedAt: integer({ mode: 'timestamp_ms' }),
    createdAt: integer({ mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer({ mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date())
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
