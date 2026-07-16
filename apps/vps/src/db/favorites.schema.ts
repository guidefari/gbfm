import { z } from 'zod'
import { type InferInsertModel, type InferSelectModel, relations } from 'drizzle-orm'
import { index, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core'
import { audioTable } from './audio.schema'
import { user } from './auth.schema'
import { showsTable } from './show.schema'

export const favoritesTable = pgTable(
  'favorites',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    audioId: uuid('audio_id').references(() => audioTable.id, {
      onDelete: 'cascade'
    }),
    showId: uuid('show_id').references(() => showsTable.id, {
      onDelete: 'cascade'
    }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
  },
  (t) => [
    index('favorites_user_created_idx').on(t.userId, t.createdAt),
    unique('unique_user_audio').on(t.userId, t.audioId),
    unique('unique_user_show').on(t.userId, t.showId)
  ]
)

export type SelectFavorite = InferSelectModel<typeof favoritesTable>
export type InsertFavorite = InferInsertModel<typeof favoritesTable>

export const favoritesRelations = relations(favoritesTable, ({ one }) => ({
  user: one(user, {
    fields: [favoritesTable.userId],
    references: [user.id]
  }),
  audio: one(audioTable, {
    fields: [favoritesTable.audioId],
    references: [audioTable.id]
  }),
  show: one(showsTable, {
    fields: [favoritesTable.showId],
    references: [showsTable.id]
  })
}))

export const selectFavoriteSchema = z.object({
  id: z.string().uuid(),
  userId: z.string(),
  audioId: z.string().uuid().nullable(),
  showId: z.string().uuid().nullable(),
  createdAt: z.date()
})

export const insertFavoriteSchema = z
  .object({
    audioId: z.string().uuid().optional(),
    showId: z.string().uuid().optional()
  })
  .refine((data) => data.audioId || data.showId, {
    message: 'Either audioId or showId must be provided'
  })

export const favoriteWithAudioSchema = z.object({
  id: z.string().uuid(),
  userId: z.string(),
  audioId: z.string().uuid().nullable(),
  showId: z.string().uuid().nullable(),
  createdAt: z.string(),
  audio: z
    .object({
      id: z.string().uuid(),
      title: z.string(),
      slug: z.string(),
      thumbnailUrl: z.string().nullable(),
      type: z.enum(['mix', 'track', 'misc']),
      url: z.string()
    })
    .nullable(),
  show: z
    .object({
      id: z.string().uuid(),
      title: z.string(),
      slug: z.string(),
      thumbnailUrl: z.string().nullable()
    })
    .nullable()
})
