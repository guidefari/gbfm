import { type InferInsertModel, type InferSelectModel, relations } from 'drizzle-orm'
import { index, integer, sqliteTable, text, unique } from 'drizzle-orm/sqlite-core'
import { audioTable } from './audio.schema'
import { user } from './auth.schema'
import { showsTable } from './show.schema'

export const favoritesTable = sqliteTable(
  'favorites',
  {
    id: text('id')
      .$defaultFn(() => crypto.randomUUID())
      .primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    audioId: text('audio_id').references(() => audioTable.id, {
      onDelete: 'cascade'
    }),
    showId: text('show_id').references(() => showsTable.id, {
      onDelete: 'cascade'
    }),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .$defaultFn(() => new Date())
      .notNull()
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
