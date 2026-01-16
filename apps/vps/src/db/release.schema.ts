import { z } from '@hono/zod-openapi'
import {
  type InferInsertModel,
  type InferSelectModel,
  relations
} from 'drizzle-orm'
import { index, jsonb, pgTable, timestamp, uuid } from 'drizzle-orm/pg-core'
import { labelsTable } from './label.schema'
import { defaultContentFields } from './util'

const streamingLinkSchema = z
  .object({
    platform: z
      .string()
      .openapi({ description: 'Streaming platform name', example: 'spotify' }),
    url: z.string().url().openapi({
      description: 'Streaming URL',
      example: 'https://spotify.com/track/...'
    })
  })
  .openapi('StreamingLink')

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
  title: z
    .string()
    .min(1)
    .openapi({ description: 'Title of the release', example: 'My Album' }),
  description: z
    .string()
    .optional()
    .openapi({ description: 'Description of the release' }),
  thumbnailUrl: z
    .string()
    .optional()
    .openapi({ description: 'Thumbnail URL for the release' }),
  slug: z
    .string()
    .min(1)
    .openapi({ description: 'URL slug for the release', example: 'my-album' }),
  content: z.string().openapi({ description: 'Content of the release' }),
  draft: z
    .boolean()
    .optional()
    .openapi({ description: 'Whether this is a draft', default: false }),
  tags: z
    .array(z.string())
    .optional()
    .openapi({ description: 'Tags for the release' }),
  labelId: z
    .string()
    .uuid()
    .openapi({ description: 'ID of the label this release belongs to' }),
  releaseDate: z.date().optional().openapi({ description: 'Release date' }),
  streamingLinks: z
    .array(streamingLinkSchema)
    .optional()
    .openapi({ description: 'Streaming platform links' })
}

export const insertReleaseSchema = z
  .object(baseReleaseFields)
  .extend({
    releaseDate: z.string().openapi({
      description: 'Release date as ISO string',
      example: '2024-01-01'
    })
  })
  .openapi('InsertRelease')

export const selectReleaseSchema = insertReleaseSchema
  .extend({
    id: z
      .string()
      .openapi({ description: 'Unique identifier for the release' }),
    createdAt: z.date().openapi({ description: 'Creation timestamp' }),
    updatedAt: z.date().openapi({ description: 'Last update timestamp' }),
    description: z
      .string()
      .nullable()
      .openapi({ description: 'Description of the release' }),
    thumbnailUrl: z
      .string()
      .nullable()
      .openapi({ description: 'Thumbnail URL for the release' }),
    draft: z
      .boolean()
      .openapi({ description: 'Whether the release is a draft' }),
    tags: z
      .array(z.string())
      .nullable()
      .openapi({ description: 'Tags associated with the release' }),
    releaseDate: z.date().nullable().openapi({ description: 'Release date' }),
    streamingLinks: z
      .array(streamingLinkSchema)
      .nullable()
      .openapi({ description: 'Streaming platform links' })
  })
  .openapi('Release')

export const selectMdxCompiledReleaseSchema = selectReleaseSchema
  .extend({
    compiledContent: z.string().openapi({ description: 'Compiled MDX content' })
  })
  .openapi('CompiledRelease')

export const updateReleaseSchema = insertReleaseSchema
  .partial()
  .openapi('UpdateReleaseRequest')

export const createReleaseSchema = insertReleaseSchema.openapi(
  'CreateReleaseRequest'
)

export const releasesRelations = relations(releasesTable, ({ one }) => ({
  label: one(labelsTable, {
    fields: [releasesTable.labelId],
    references: [labelsTable.id]
  })
}))
