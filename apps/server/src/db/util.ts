import { integer, text } from 'drizzle-orm/sqlite-core'

export const defaultAuditFields = {
  createdBy: text(),
  updatedBy: text(),
  deletedAt: integer({ mode: 'timestamp_ms' }),
  deletedBy: text()
}

export const defaultContentFields = {
  id: text()
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  title: text().notNull(),
  description: text(),
  thumbnailUrl: text(),
  bannerImageUrl: text(),
  slug: text().notNull(),
  createdAt: integer({ mode: 'timestamp_ms' })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer({ mode: 'timestamp_ms' })
    .notNull()
    .$defaultFn(() => new Date()),
  draft: integer({ mode: 'boolean' }).notNull().default(false),
  content: text().notNull()
}
