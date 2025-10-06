import {
  type InferInsertModel,
  type InferSelectModel,
  relations
} from 'drizzle-orm'
import { index, pgTable, primaryKey, uuid, varchar } from 'drizzle-orm/pg-core'
import { z } from 'zod/v4'
import { authorsTable } from './author.schema'
import { defaultContentFields } from './util'

export const mixesTable = pgTable(
  'mixes',
  {
    ...defaultContentFields,
    url: varchar({ length: 255 }).notNull()
  },
  (table) => [index('mixes_slug_idx').on(table.slug)]
)

export type SelectMix = InferSelectModel<typeof mixesTable>
export type InsertMix = InferInsertModel<typeof mixesTable>

export type SelectMdxCompiledMix = SelectMix & {
  compiledContent: string
  authors?: Array<{
    id: string
    name: string
    username: string
  }>
}

const _selectMixSchemaV4 = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  thumbnailUrl: z.string().nullable(),
  slug: z.string(),
  content: z.string(),
  draft: z.boolean(),
  tags: z.array(z.string()).nullable(),
  url: z.string(),
  createdAt: z.date(),
  updatedAt: z.date()
})

export const selectMixSchema = _selectMixSchemaV4

export const selectMdxCompiledMixSchema = _selectMixSchemaV4.extend({
  compiledContent: z.string(),
  authors: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        username: z.string()
      })
    )
    .optional()
})

const _insertMixSchemaV4 = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  thumbnailUrl: z.string().optional(),
  slug: z.string().min(1),
  content: z.string(),
  draft: z.boolean().optional(),
  tags: z.array(z.string()).optional(),
  url: z.string().url()
})

export const insertMixSchema = _insertMixSchemaV4

export const createMixSchema = _insertMixSchemaV4.extend({
  authorIds: z.array(z.uuid()).min(1).optional()
})

export const mixesToAuthors = pgTable(
  'mixes_to_authors',
  {
    mixId: uuid()
      .notNull()
      .references(() => mixesTable.id),
    authorId: uuid()
      .notNull()
      .references(() => authorsTable.id)
  },
  (t) => [primaryKey({ columns: [t.mixId, t.authorId] })]
)

export const mixesRelations = relations(mixesTable, ({ many }) => ({
  mixesToAuthors: many(mixesToAuthors)
}))

export const mixesToAuthorsRelations = relations(mixesToAuthors, ({ one }) => ({
  mix: one(mixesTable, {
    fields: [mixesToAuthors.mixId],
    references: [mixesTable.id]
  }),
  author: one(authorsTable, {
    fields: [mixesToAuthors.authorId],
    references: [authorsTable.id]
  })
}))
