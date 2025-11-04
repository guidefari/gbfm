import {
  type InferInsertModel,
  type InferSelectModel,
  relations
} from 'drizzle-orm'
import { pgTable, text, uuid } from 'drizzle-orm/pg-core'
import { z } from 'zod/v4'
import { usersTable } from './user.schema'
import { postsTable } from './post.schema'

export const publicationsTable = pgTable('publications', {
  id: uuid().defaultRandom().primaryKey(),
  name: text().notNull(),
  description: text(),
  slug: text().notNull().unique()
})

export const publicationAuthors = pgTable('publication_authors', {
  publicationId: uuid()
    .notNull()
    .references(() => publicationsTable.id, { onDelete: 'cascade' }),
  authorId: uuid()
    .notNull()
    .references(() => usersTable.id, { onDelete: 'cascade' })
})

export const publicationPosts = pgTable('publication_posts', {
  publicationId: uuid()
    .notNull()
    .references(() => publicationsTable.id, { onDelete: 'cascade' }),
  postId: uuid()
    .notNull()
    .references(() => postsTable.id, { onDelete: 'cascade' })
})

export const publicationsRelations = relations(
  publicationsTable,
  ({ many }) => ({
    publicationAuthors: many(publicationAuthors)
  })
)

export const publicationAuthorsRelations = relations(
  publicationAuthors,
  ({ one }) => ({
    publication: one(publicationsTable, {
      fields: [publicationAuthors.publicationId],
      references: [publicationsTable.id]
    }),
    author: one(usersTable, {
      fields: [publicationAuthors.authorId],
      references: [usersTable.id]
    })
  })
)

export const publicationPostsRelations = relations(
  publicationPosts,
  ({ one }) => ({
    publication: one(publicationsTable, {
      fields: [publicationPosts.publicationId],
      references: [publicationsTable.id]
    }),
    post: one(postsTable, {
      fields: [publicationPosts.postId],
      references: [postsTable.id]
    })
  })
)

export type SelectPublication = InferSelectModel<typeof publicationsTable>
export type InsertPublication = InferInsertModel<typeof publicationsTable>

export const selectPublicationSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  slug: z.string()
})

export const insertPublicationSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  slug: z.string()
})

export const createPublicationSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  slug: z.string()
})

export const updatePublicationSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  slug: z.string().optional()
})

export const publicationParamsSchema = z.object({
  id: z.uuid()
})
