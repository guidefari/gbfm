import { boolean, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core'

export const defaultContentFields = {
  id: uuid().primaryKey().defaultRandom(),
  title: varchar({ length: 255 }).notNull(),
  description: text(),
  thumbnailUrl: varchar({ length: 255 }),
  bannerImageUrl: varchar({ length: 255 }),
  slug: varchar({ length: 255 }).notNull(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  draft: boolean().notNull().default(false),
  tags: varchar({ length: 255 }).array(),
  content: text().notNull()
}
