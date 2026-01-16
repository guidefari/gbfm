import { z } from '@hono/zod-openapi'
import {
  type InferInsertModel,
  type InferSelectModel,
  relations
} from 'drizzle-orm'
import {
  index,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  uuid,
  varchar
} from 'drizzle-orm/pg-core'
import { user } from './auth.schema'
import { defaultContentFields } from './util'

export const audioTypeEnum = pgEnum('audio_type', ['mix', 'track', 'misc'])

export const audioTable = pgTable(
  'audio',
  {
    ...defaultContentFields,
    type: audioTypeEnum().notNull(),
    url: varchar({ length: 255 }).notNull()
  },
  (table) => [index('audio_slug_idx').on(table.slug)]
)

export type SelectAudio = InferSelectModel<typeof audioTable>
export type InsertAudio = InferInsertModel<typeof audioTable>

export type SelectMdxCompiledAudio = SelectAudio & {
  compiledContent: string
  creators?: Array<{
    id: string
    name: string
  }>
}

export const selectAudioSchema = z
  .object({
    id: z.string().openapi({ description: 'Unique identifier for the audio' }),
    title: z.string().openapi({ description: 'Title of the audio' }),
    description: z
      .string()
      .nullable()
      .openapi({ description: 'Description of the audio' }),
    thumbnailUrl: z
      .string()
      .nullable()
      .openapi({ description: 'Thumbnail URL for the audio' }),
    slug: z.string().openapi({ description: 'URL slug for the audio' }),
    content: z.string().openapi({ description: 'Content of the audio' }),
    draft: z.boolean().openapi({ description: 'Whether the audio is a draft' }),
    tags: z
      .array(z.string())
      .nullable()
      .openapi({ description: 'Tags associated with the audio' }),
    type: z
      .enum(['mix', 'track', 'misc'])
      .openapi({ description: 'Type of audio content' }),
    url: z.string().openapi({ description: 'Audio URL' }),
    createdAt: z.date().openapi({ description: 'Creation timestamp' }),
    updatedAt: z.date().openapi({ description: 'Last update timestamp' })
  })
  .openapi('Audio')

export const selectMdxCompiledAudioSchema = selectAudioSchema
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
      .openapi({ description: 'List of creators for this audio' })
  })
  .openapi('CompiledAudio')

export const insertAudioSchema = z
  .object({
    title: z
      .string()
      .min(1)
      .openapi({ description: 'Title of the audio', example: 'My Mix' }),
    description: z
      .string()
      .optional()
      .openapi({ description: 'Description of the audio' }),
    thumbnailUrl: z
      .string()
      .optional()
      .openapi({ description: 'Thumbnail URL for the audio' }),
    slug: z
      .string()
      .min(1)
      .openapi({ description: 'URL slug for the audio', example: 'my-mix' }),
    content: z.string().openapi({ description: 'Content of the audio' }),
    draft: z
      .boolean()
      .optional()
      .openapi({ description: 'Whether this is a draft', default: false }),
    tags: z
      .array(z.string())
      .optional()
      .openapi({ description: 'Tags for the audio' }),
    type: z
      .enum(['mix', 'track', 'misc'])
      .openapi({ description: 'Type of audio content', example: 'mix' }),
    url: z.string().url().openapi({
      description: 'Audio URL',
      example: 'https://example.com/audio.mp3'
    })
  })
  .openapi('InsertAudio')

export const updateAudioSchema = insertAudioSchema
  .partial()
  .openapi('UpdateAudioRequest')

export const createAudioSchema = insertAudioSchema
  .extend({
    creatorIds: z
      .array(z.string())
      .min(1)
      .optional()
      .openapi({ description: 'IDs of audio creators' })
  })
  .openapi('CreateAudioRequest')

export const audioCreators = pgTable(
  'audio_creators',
  {
    audioId: uuid()
      .notNull()
      .references(() => audioTable.id),
    creatorId: text()
      .notNull()
      .references(() => user.id)
  },
  (t) => [primaryKey({ columns: [t.audioId, t.creatorId] })]
)

export const audioRelations = relations(audioTable, ({ many }) => ({
  audioCreators: many(audioCreators)
}))

export const audioCreatorsRelations = relations(audioCreators, ({ one }) => ({
  audio: one(audioTable, {
    fields: [audioCreators.audioId],
    references: [audioTable.id]
  }),
  creator: one(user, {
    fields: [audioCreators.creatorId],
    references: [user.id]
  })
}))
