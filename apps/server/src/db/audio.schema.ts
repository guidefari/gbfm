import { z } from 'zod'
import { type InferInsertModel, type InferSelectModel, relations } from 'drizzle-orm'
import { index, integer, sqliteTable, primaryKey, text, uniqueIndex } from 'drizzle-orm/sqlite-core'
import { user } from './auth.schema'
import { showsTable } from './show.schema'
import { defaultContentFields } from './util'

export const audioTypeEnum = ['mix', 'track', 'misc'] as const

export const audioTable = sqliteTable(
  'audio',
  {
    ...defaultContentFields,
    type: text({ enum: audioTypeEnum }).notNull(),
    url: text().notNull(),
    idempotencyKey: text(),
    idempotencyActorId: text(),
    idempotencyFingerprint: text(),
    showId: text().references(() => showsTable.id, { onDelete: 'set null' }),
    episodeNumber: integer(),
    playCount: integer().notNull().default(0)
  },
  (table) => [
    index('audio_slug_idx').on(table.slug),
    uniqueIndex('audio_type_slug_unique').on(table.type, table.slug),
    uniqueIndex('audio_actor_idempotency_unique').on(
      table.idempotencyActorId,
      table.idempotencyKey
    ),
    index('audio_show_idx').on(table.showId),
    index('audio_type_created_idx').on(table.type, table.createdAt)
  ]
)

type AudioPersistenceFields = 'idempotencyKey' | 'idempotencyActorId' | 'idempotencyFingerprint'
type BaseSelectAudio = Omit<InferSelectModel<typeof audioTable>, AudioPersistenceFields>
export type InsertAudio = Omit<InferInsertModel<typeof audioTable>, AudioPersistenceFields> & {
  tags?: string[]
}

export type Creator = {
  id: string
  name: string
  username: string | null
}

export type SelectAudio = BaseSelectAudio & {
  tags: string[] | null
  creators?: Creator[]
}

export type SelectMdxCompiledAudio = SelectAudio & {
  compiledContent: string
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
  showId: z.string().nullable(),
  episodeNumber: z.number().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
  playCount: z.number().int(),
  creators: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        username: z.string().nullable()
      })
    )
    .optional()
})

export const selectMdxCompiledAudioSchema = selectAudioSchema.extend({
  compiledContent: z.string(),
  creators: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        username: z.string().nullable()
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
  url: z.string().url(),
  showId: z.string().uuid().optional(),
  episodeNumber: z.number().int().positive().optional()
})

export const updateAudioSchema = insertAudioSchema
  .extend({
    creatorIds: z.array(z.string()).min(1).optional()
  })
  .partial()

export const createAudioSchema = insertAudioSchema.extend({
  creatorIds: z.array(z.string()).min(1).optional()
})

export const audioCreators = sqliteTable(
  'audio_creators',
  {
    audioId: text()
      .notNull()
      .references(() => audioTable.id),
    creatorId: text()
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' })
  },
  (t) => [
    primaryKey({ columns: [t.audioId, t.creatorId] }),
    index('audio_creators_creatorId_idx').on(t.creatorId)
  ]
)

export const audioRelations = relations(audioTable, ({ many, one }) => ({
  audioCreators: many(audioCreators),
  show: one(showsTable, {
    fields: [audioTable.showId],
    references: [showsTable.id]
  })
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
