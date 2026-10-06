import { sql, type SQLWrapper } from 'drizzle-orm'
import { Schema } from 'effect'

const decodeTags = Schema.decodeUnknownSync(Schema.fromJsonString(Schema.Array(Schema.String)))

// Nested SQL preserves the outer alias through Drizzle's single-table selection rewrite.
export const entityTagsProjection = (entityType: 'audio' | 'show', entityId: SQLWrapper) =>
  sql<string>`(
    SELECT json_group_array(name)
    FROM (
      SELECT labels.name
      FROM entity_labels
      INNER JOIN labels ON labels.id = entity_labels.label_id
      WHERE entity_labels.entity_type = ${entityType}
        AND entity_labels.entity_id = ${sql`${entityId}`}
        AND labels.kind = 'tag'
      ORDER BY entity_labels.position
    )
  )`.as('entity_tags')

export const decodeEntityTags = (value: string) => {
  const tags = decodeTags(value)

  return tags.length > 0 ? [...tags] : null
}
