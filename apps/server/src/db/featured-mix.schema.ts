import { sql } from 'drizzle-orm'
import { check, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

import { audioTable } from './audio.schema'

/** A single editorial selection; deleting its audio restores automatic selection. */
export const featuredMixTable = sqliteTable(
  'featured_mix',
  {
    slot: integer().primaryKey().default(1),
    audioId: text('audio_id')
      .notNull()
      .references(() => audioTable.id, { onDelete: 'cascade' }),
  },
  (table) => [check('featured_mix_singleton', sql`${table.slot} = 1`)],
)
