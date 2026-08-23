import { type InferInsertModel, type InferSelectModel, relations } from 'drizzle-orm'
import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { musicLabelsTable } from './music-entity.schema'
import { defaultContentFields } from './util'

export const releasesTable = sqliteTable(
  'releases',
  {
    ...defaultContentFields,
    labelId: text()
      .notNull()
      .references(() => musicLabelsTable.id),
    releaseDate: integer({ mode: 'timestamp_ms' }),
    streamingLinks: text({ mode: 'json' }).$type<Array<{ platform: string; url: string }>>()
  },
  (table) => [index('releases_slug_idx').on(table.slug)]
)

export type SelectRelease = InferSelectModel<typeof releasesTable> & { tags: string[] | null }
export type InsertRelease = InferInsertModel<typeof releasesTable> & { tags?: string[] }

export type SelectMdxCompiledRelease = SelectRelease & {
  compiledContent: string
}

export const releasesRelations = relations(releasesTable, ({ one }) => ({
  label: one(musicLabelsTable, {
    fields: [releasesTable.labelId],
    references: [musicLabelsTable.id]
  })
}))
