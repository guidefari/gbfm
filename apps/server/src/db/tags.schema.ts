import { index, integer, primaryKey, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'

export const labelsTable = sqliteTable(
  'labels',
  {
    id: text()
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    kind: text({ enum: ['tag', 'genre'] }).notNull(),
    name: text().notNull()
  },
  (table) => [uniqueIndex('labels_kind_name_uq').on(table.kind, table.name)]
)

export const entityLabelsTable = sqliteTable(
  'entity_labels',
  {
    entityType: text('entity_type', {
      enum: ['audio', 'show', 'post', 'release', 'artist', 'album', 'track', 'musicLabel']
    }).notNull(),
    entityId: text('entity_id').notNull(),
    position: integer().notNull(),
    labelId: text('label_id')
      .notNull()
      .references(() => labelsTable.id, { onDelete: 'cascade' })
  },
  (table) => [
    primaryKey({ columns: [table.entityType, table.entityId, table.labelId] }),
    index('entity_labels_label_idx').on(table.labelId, table.entityType)
  ]
)
