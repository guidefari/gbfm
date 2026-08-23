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
