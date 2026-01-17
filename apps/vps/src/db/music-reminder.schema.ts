import {
  type InferInsertModel,
  type InferSelectModel,
  relations
} from 'drizzle-orm'
import {
  boolean,
  index,
  pgTable,
  text,
  timestamp,
  uuid
} from 'drizzle-orm/pg-core'
import { user } from './auth.schema'

export const musicReminder = pgTable(
  'music_reminder',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    musicTitle: text('music_title').notNull(),
    artistName: text('artist_name').notNull(),
    musicUrl: text('music_url').notNull(),
    albumCoverUrl: text('album_cover_url'),
    reminderDate: timestamp('reminder_date').notNull(),
    notes: text('notes'),
    isSent: boolean('is_sent').default(false).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull()
  },
  (table) => [
    index('music_reminder_user_id_idx').on(table.userId),
    index('music_reminder_reminder_date_idx').on(table.reminderDate),
    index('music_reminder_is_sent_idx').on(table.isSent)
  ]
)

export const musicReminderRelations = relations(musicReminder, ({ one }) => ({
  user: one(user, {
    fields: [musicReminder.userId],
    references: [user.id]
  })
}))

export type MusicReminder = InferSelectModel<typeof musicReminder>
export type NewMusicReminder = InferInsertModel<typeof musicReminder>
