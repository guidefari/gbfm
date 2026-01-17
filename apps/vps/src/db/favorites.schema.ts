import { z } from '@hono/zod-openapi'
import {
  type InferInsertModel,
  type InferSelectModel,
  relations
} from 'drizzle-orm'
import { pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core'
import { audioTable } from './audio.schema'
import { user } from './auth.schema'

export const favoritesTable = pgTable(
  'favorites',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    audioId: uuid('audio_id')
      .notNull()
      .references(() => audioTable.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull()
  },
  (t) => [unique('unique_user_audio').on(t.userId, t.audioId)]
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
  })
}))

export const selectFavoriteSchema = z
  .object({
    id: z
      .string()
      .uuid()
      .openapi({ description: 'Unique identifier for the favorite' }),
    userId: z.string().openapi({ description: 'User ID who favorited' }),
    audioId: z
      .string()
      .uuid()
      .openapi({ description: 'Audio ID that was favorited' }),
    createdAt: z
      .date()
      .openapi({ description: 'When the favorite was created' })
  })
  .openapi('Favorite')

export const insertFavoriteSchema = z
  .object({
    audioId: z.string().uuid().openapi({
      description: 'Audio ID to favorite',
      example: '123e4567-e89b-12d3-a456-426614174000'
    })
  })
  .openapi('InsertFavorite')

export const favoriteWithAudioSchema = z
  .object({
    id: z.string().uuid(),
    userId: z.string(),
    audioId: z.string().uuid(),
    createdAt: z.string(),
    audio: z.object({
      id: z.string().uuid(),
      title: z.string(),
      slug: z.string(),
      thumbnailUrl: z.string().nullable(),
      type: z.enum(['mix', 'track', 'misc']),
      url: z.string()
    })
  })
  .openapi('FavoriteWithAudio')
