import {
  type InferInsertModel,
  type InferSelectModel,
  relations
} from 'drizzle-orm'
import { index, pgEnum, pgTable, primaryKey, uuid } from 'drizzle-orm/pg-core'
import { z } from 'zod/v4'
import { authorsTable } from './author.schema'
import { publicationsTable } from './publication.schema'
import { defaultContentFields } from './util'

export const postTypeEnum = pgEnum('post_type', ['post', 'micro'])

export const postsTable = pgTable(
  'posts',
  {
    ...defaultContentFields,
    type: postTypeEnum(),
    publicationId: uuid().references(() => publicationsTable.id, {
      onDelete: 'set null'
    })
  },
  (table) => [index('posts_slug_idx').on(table.slug)]
)

export type SelectPost = InferSelectModel<typeof postsTable>
export type InsertPost = InferInsertModel<typeof postsTable>

export type SelectMdxCompiledPost = SelectPost & {
  compiledContent: string
  authors?: Array<{
    id: string
    name: string
    username: string
  }>
  publication?: {
    id: string
    name: string
    slug: string
  }
}

export const selectPostSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  thumbnailUrl: z.string().nullable(),
  slug: z.string(),
  content: z.string(),
  draft: z.boolean(),
  tags: z.array(z.string()).nullable(),
  type: z.enum(['post', 'micro']).nullable(),
  publicationId: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date()
})

export const selectMdxCompiledPostSchema = selectPostSchema.extend({
  compiledContent: z.string(),
  authors: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        username: z.string()
      })
    )
    .optional(),
  publication: z
    .object({
      id: z.string(),
      name: z.string(),
      slug: z.string()
    })
    .optional()
})

export const insertPostSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  thumbnailUrl: z.string().optional(),
  slug: z.string().min(1),
  content: z.string(),
  draft: z.boolean().optional(),
  tags: z.array(z.string()).optional(),
  type: z.enum(['post', 'micro']).nullable().optional(),
  publicationId: z.uuid().nullable().optional()
})

export const createPostSchema = insertPostSchema.extend({
  authorIds: z.array(z.uuid()).min(1).optional()
})

export const updatePostSchema = insertPostSchema.partial()

export const postsToAuthors = pgTable(
  'posts_to_authors',
  {
    postId: uuid()
      .notNull()
      .references(() => postsTable.id),
    authorId: uuid()
      .notNull()
      .references(() => authorsTable.id)
  },
  (t) => [primaryKey({ columns: [t.postId, t.authorId] })]
)

export const postsRelations = relations(postsTable, ({ many, one }) => ({
  postsToAuthors: many(postsToAuthors),
  publication: one(publicationsTable, {
    fields: [postsTable.publicationId],
    references: [publicationsTable.id]
  })
}))

export const postsToAuthorsRelations = relations(postsToAuthors, ({ one }) => ({
  post: one(postsTable, {
    fields: [postsToAuthors.postId],
    references: [postsTable.id]
  }),
  author: one(authorsTable, {
    fields: [postsToAuthors.authorId],
    references: [authorsTable.id]
  })
}))
