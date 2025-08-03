import { relations } from 'drizzle-orm'
import {
  index,
  pgEnum,
  pgTable,
  primaryKey,
  uuid,
  varchar
} from 'drizzle-orm/pg-core'
import { createInsertSchema, createSelectSchema } from 'drizzle-zod'
import { z } from 'zod'
import { authorsTable } from './author.schema'
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

export const selectAudioSchema = createSelectSchema(audioTable).extend({
  createdAt: z
    .string()
    .or(z.date())
    .transform((val) => new Date(val)),
  updatedAt: z
    .string()
    .or(z.date())
    .transform((val) => new Date(val))
})

export const selectMdxCompiledAudioSchema = selectAudioSchema.extend({
  compiledContent: z.string(),
  frontmatter: z.record(z.string(), z.any())
})

export const insertAudioSchema = createInsertSchema(audioTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true
})

export const createAudioSchema = insertAudioSchema.extend({
  authorIds: z.array(z.string().uuid()).min(1)
})

export type InsertAudio = z.infer<typeof insertAudioSchema>
export type SelectAudio = z.infer<typeof selectAudioSchema>
export type SelectMdxCompiledAudio = z.infer<
  typeof selectMdxCompiledAudioSchema
>

export const audioToAuthors = pgTable(
  'audio_to_authors',
  {
    audioId: uuid()
      .notNull()
      .references(() => audioTable.id),
    authorId: uuid()
      .notNull()
      .references(() => authorsTable.id)
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
  author: one(authorsTable, {
    fields: [audioToAuthors.authorId],
    references: [authorsTable.id]
  })
}))
