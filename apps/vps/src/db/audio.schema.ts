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
  uuid,
  varchar
} from 'drizzle-orm/pg-core'
import { z } from 'zod/v4'
import { usersTable } from './user.schema'
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
  authors?: Array<{
    id: string
    name: string
    username: string
  }>
}

export const selectAudioSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  thumbnailUrl: z.string().nullable(),
  slug: z.string(),
  content: z.string(),
  draft: z.boolean(),
  tags: z.array(z.string()).nullable(),
  type: z.enum(['mix', 'track', 'misc']),
  url: z.string(),
  createdAt: z.date(),
  updatedAt: z.date()
})

export const selectMdxCompiledAudioSchema = selectAudioSchema.extend({
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

export const insertAudioSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  thumbnailUrl: z.string().optional(),
  slug: z.string().min(1),
  content: z.string(),
  draft: z.boolean().optional(),
  tags: z.array(z.string()).optional(),
  type: z.enum(['mix', 'track', 'misc']),
  url: z.url()
})

export const updateAudioSchema = insertAudioSchema.partial()

export const createAudioSchema = insertAudioSchema.extend({
  authorIds: z.array(z.uuid()).min(1).optional()
})

export const audioToAuthors = pgTable(
  'audio_to_authors',
  {
    audioId: uuid()
      .notNull()
      .references(() => audioTable.id),
    authorId: uuid()
      .notNull()
      .references(() => usersTable.id)
  },
  (t) => [primaryKey({ columns: [t.audioId, t.authorId] })]
)

export const audioRelations = relations(audioTable, ({ many }) => ({
  audioToAuthors: many(audioToAuthors)
}))

export const audioToAuthorsRelations = relations(audioToAuthors, ({ one }) => ({
  audio: one(audioTable, {
    fields: [audioToAuthors.audioId],
    references: [audioTable.id]
  }),
  author: one(usersTable, {
    fields: [audioToAuthors.authorId],
    references: [usersTable.id]
  })
}))
