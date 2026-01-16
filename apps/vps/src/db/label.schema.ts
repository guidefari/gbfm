import { z } from '@hono/zod-openapi'
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

export const selectLabelSchema = z
  .object({
    id: z.string().openapi({ description: 'Unique identifier for the label' }),
    title: z.string().openapi({ description: 'Title of the label' }),
    description: z
      .string()
      .nullable()
      .openapi({ description: 'Description of the label' }),
    thumbnailUrl: z
      .string()
      .nullable()
      .openapi({ description: 'Thumbnail URL for the label' }),
    slug: z.string().openapi({ description: 'URL slug for the label' }),
    content: z.string().openapi({ description: 'Content of the label' }),
    draft: z.boolean().openapi({ description: 'Whether the label is a draft' }),
    tags: z
      .array(z.string())
      .nullable()
      .openapi({ description: 'Tags associated with the label' }),
    website: z
      .string()
      .nullable()
      .openapi({ description: 'Website URL for the label' }),
    discogs: z
      .string()
      .nullable()
      .openapi({ description: 'Discogs URL for the label' }),
    bandcamp: z
      .string()
      .nullable()
      .openapi({ description: 'Bandcamp URL for the label' }),
    genres: z
      .array(z.string())
      .nullable()
      .openapi({ description: 'Genres associated with the label' }),
    createdAt: z.date().openapi({ description: 'Creation timestamp' }),
    updatedAt: z.date().openapi({ description: 'Last update timestamp' })
  })
  .openapi('Label')

export const selectMdxCompiledLabelSchema = selectLabelSchema
  .extend({
    compiledContent: z
      .string()
      .openapi({ description: 'Compiled MDX content' }),
    creators: z
      .array(
        z
          .object({
            id: z.string().openapi({ description: 'Creator ID' }),
            name: z.string().openapi({ description: 'Creator name' })
          })
          .openapi('Creator')
      )
      .optional()
      .openapi({ description: 'List of creators for this label' })
  })
  .openapi('CompiledLabel')

export const insertLabelSchema = z
  .object({
    title: z
      .string()
      .min(1)
      .openapi({ description: 'Title of the label', example: 'Indie Records' }),
    description: z
      .string()
      .optional()
      .openapi({ description: 'Description of the label' }),
    thumbnailUrl: z
      .string()
      .optional()
      .openapi({ description: 'Thumbnail URL for the label' }),
    slug: z.string().min(1).openapi({
      description: 'URL slug for the label',
      example: 'indie-records'
    }),
    content: z.string().openapi({ description: 'Content of the label' }),
    draft: z
      .boolean()
      .optional()
      .openapi({ description: 'Whether this is a draft', default: false }),
    tags: z
      .array(z.string())
      .optional()
      .openapi({ description: 'Tags for the label' }),
    website: z
      .string()
      .url()
      .optional()
      .openapi({ description: 'Website URL' }),
    discogs: z
      .string()
      .url()
      .optional()
      .openapi({ description: 'Discogs URL' }),
    bandcamp: z
      .string()
      .url()
      .optional()
      .openapi({ description: 'Bandcamp URL' }),
    genres: z
      .array(z.string())
      .optional()
      .openapi({ description: 'Genres for the label' })
  })
  .openapi('InsertLabel')

export const createLabelSchema = insertLabelSchema
  .extend({
    creatorIds: z
      .array(z.string())
      .min(1)
      .optional()
      .openapi({ description: 'IDs of label creators' })
  })
  .openapi('CreateLabelRequest')

export const updateLabelSchema = insertLabelSchema
  .partial()
  .openapi('UpdateLabelRequest')

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
