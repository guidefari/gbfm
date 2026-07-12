import { z } from 'zod'
import { type InferInsertModel, type InferSelectModel, relations } from 'drizzle-orm'
import { index, jsonb, pgTable, timestamp, uuid } from 'drizzle-orm/pg-core'
import { labelsTable } from './label.schema'
import { defaultContentFields } from './util'

const streamingLinkSchema = z.object({
  platform: z.string(),
  url: z.string().url()
})

export const releasesTable = pgTable(
  'releases',
  {
    ...defaultContentFields,
    labelId: uuid()
      .notNull()
      .references(() => labelsTable.id),
    releaseDate: timestamp({ withTimezone: true }),
    streamingLinks: jsonb().$type<Array<{ platform: string; url: string }>>()
  },
  (table) => [index('releases_slug_idx').on(table.slug)]
)

export type SelectRelease = InferSelectModel<typeof releasesTable>
export type InsertRelease = InferInsertModel<typeof releasesTable>

export type SelectMdxCompiledRelease = SelectRelease & {
  compiledContent: string
}

const baseReleaseFields = {
  title: z.string().min(1),
  description: z.string().optional(),
  thumbnailUrl: z.string().optional(),
  slug: z.string().min(1),
  content: z.string(),
  draft: z.boolean().optional(),
  tags: z.array(z.string()).optional(),
  labelId: z.string().uuid(),
  releaseDate: z.date().optional(),
  streamingLinks: z.array(streamingLinkSchema).optional()
}

export const insertReleaseSchema = z.object(baseReleaseFields).extend({
  releaseDate: z.string()
})

export const selectReleaseSchema = insertReleaseSchema.extend({
  id: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
  description: z.string().nullable(),
  thumbnailUrl: z.string().nullable(),
  draft: z.boolean(),
  tags: z.array(z.string()).nullable(),
  releaseDate: z.date().nullable(),
  streamingLinks: z.array(streamingLinkSchema).nullable()
})

export const selectMdxCompiledReleaseSchema = selectReleaseSchema.extend({
  compiledContent: z.string()
})

export const updateReleaseSchema = insertReleaseSchema.partial()

export const createReleaseSchema = insertReleaseSchema

export const releasesRelations = relations(releasesTable, ({ one }) => ({
  label: one(labelsTable, {
    fields: [releasesTable.labelId],
    references: [labelsTable.id]
  })
}))
