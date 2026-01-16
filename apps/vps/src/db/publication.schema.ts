import { z } from '@hono/zod-openapi'
import {
  type InferInsertModel,
  type InferSelectModel,
  relations
} from 'drizzle-orm'
import { pgTable, text, uuid } from 'drizzle-orm/pg-core'
import { user } from './auth.schema'
import { postsTable } from './post.schema'

export const publicationsTable = pgTable('publications', {
  id: uuid().defaultRandom().primaryKey(),
  name: text().notNull(),
  description: text(),
  slug: text().notNull().unique()
})

export const publicationMembers = pgTable('publication_members', {
  publicationId: uuid()
    .notNull()
    .references(() => publicationsTable.id, { onDelete: 'cascade' }),
  userId: text()
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' })
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
    publicationMembers: many(publicationMembers)
  })
)

export const publicationMembersRelations = relations(
  publicationMembers,
  ({ one }) => ({
    publication: one(publicationsTable, {
      fields: [publicationMembers.publicationId],
      references: [publicationsTable.id]
    }),
    user: one(user, {
      fields: [publicationMembers.userId],
      references: [user.id]
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

export const selectPublicationSchema = z
  .object({
    id: z
      .string()
      .openapi({ description: 'Unique identifier for the publication' }),
    name: z.string().openapi({ description: 'Name of the publication' }),
    description: z
      .string()
      .nullable()
      .openapi({ description: 'Description of the publication' }),
    slug: z.string().openapi({ description: 'URL slug for the publication' })
  })
  .openapi('Publication')

export const insertPublicationSchema = z
  .object({
    name: z
      .string()
      .min(1)
      .openapi({ description: 'Name of the publication', example: 'My Blog' }),
    description: z
      .string()
      .optional()
      .openapi({ description: 'Description of the publication' }),
    slug: z.string().openapi({
      description: 'URL slug for the publication',
      example: 'my-blog'
    })
  })
  .openapi('InsertPublication')

export const createPublicationSchema = z
  .object({
    name: z
      .string()
      .min(1)
      .openapi({ description: 'Name of the publication', example: 'My Blog' }),
    description: z
      .string()
      .optional()
      .openapi({ description: 'Description of the publication' }),
    slug: z.string().openapi({
      description: 'URL slug for the publication',
      example: 'my-blog'
    })
  })
  .openapi('CreatePublicationRequest')

export const updatePublicationSchema = z
  .object({
    name: z
      .string()
      .min(1)
      .optional()
      .openapi({ description: 'Name of the publication' }),
    description: z
      .string()
      .optional()
      .openapi({ description: 'Description of the publication' }),
    slug: z
      .string()
      .optional()
      .openapi({ description: 'URL slug for the publication' })
  })
  .openapi('UpdatePublicationRequest')

export const publicationParamsSchema = z
  .object({
    id: z.string().uuid().openapi({
      description: 'Publication ID',
      example: '123e4567-e89b-12d3-a456-426614174000'
    })
  })
  .openapi('PublicationParams')
