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
  uuid,
  varchar
} from 'drizzle-orm/pg-core'
import { z } from 'zod/v4'
import { user } from './auth.schema'
import { releasesTable } from './release.schema'
import { defaultContentFields } from './util'

export const labelsTable = pgTable(
  'labels',
  {
    ...defaultContentFields,
    website: varchar({ length: 255 }),
    discogs: varchar({ length: 255 }),
    bandcamp: varchar({ length: 255 }),
    genres: varchar({ length: 255 }).array()
  },
  (table) => [index('labels_slug_idx').on(table.slug)]
)

export type SelectLabel = InferSelectModel<typeof labelsTable>
export type InsertLabel = InferInsertModel<typeof labelsTable>

export type SelectMdxCompiledLabel = SelectLabel & {
  compiledContent: string
  creators?: Array<{
    id: string
    name: string
  }>
}

export const selectLabelSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  thumbnailUrl: z.string().nullable(),
  slug: z.string(),
  content: z.string(),
  draft: z.boolean(),
  tags: z.array(z.string()).nullable(),
  website: z.string().nullable(),
  discogs: z.string().nullable(),
  bandcamp: z.string().nullable(),
  genres: z.array(z.string()).nullable(),
  createdAt: z.date(),
  updatedAt: z.date()
})

export const selectMdxCompiledLabelSchema = selectLabelSchema.extend({
  compiledContent: z.string(),
  creators: z
    .array(
      z.object({
        id: z.string(),
        name: z.string()
      })
    )
    .optional()
})

export const insertLabelSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  thumbnailUrl: z.string().optional(),
  slug: z.string().min(1),
  content: z.string(),
  draft: z.boolean().optional(),
  tags: z.array(z.string()).optional(),
  website: z.url().optional(),
  discogs: z.url().optional(),
  bandcamp: z.url().optional(),
  genres: z.array(z.string()).optional()
})

export const createLabelSchema = insertLabelSchema.extend({
  creatorIds: z.array(z.string()).min(1).optional()
})

export const updateLabelSchema = insertLabelSchema.partial()

export const labelCreators = pgTable(
  'label_creators',
  {
    labelId: uuid()
      .notNull()
      .references(() => labelsTable.id),
    creatorId: text()
      .notNull()
      .references(() => user.id)
  },
  (t) => [primaryKey({ columns: [t.labelId, t.creatorId] })]
)

export const labelsRelations = relations(labelsTable, ({ many }) => ({
  labelCreators: many(labelCreators),
  releases: many(releasesTable)
}))

export const labelCreatorsRelations = relations(labelCreators, ({ one }) => ({
  label: one(labelsTable, {
    fields: [labelCreators.labelId],
    references: [labelsTable.id]
  }),
  creator: one(user, {
    fields: [labelCreators.creatorId],
    references: [user.id]
  })
}))
