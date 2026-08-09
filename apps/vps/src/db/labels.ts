import { and, asc, eq, inArray, sql, type SQLWrapper } from 'drizzle-orm'
import type { DatabaseClient } from './layer'
import { entityLabelsTable, labelsTable } from './tags.schema'

export type LabelEntityType =
  | 'album'
  | 'artist'
  | 'audio'
  | 'musicLabel'
  | 'post'
  | 'release'
  | 'show'
  | 'track'

type LabelsInput = {
  readonly genres?: ReadonlyArray<string> | null
  readonly tags?: ReadonlyArray<string> | null
}

const distinct = (values: ReadonlyArray<string>) => [...new Set(values)]

const label = (kind: 'tag' | 'genre', name: string) => ({ kind, name })

export const replaceEntityLabels = async (
  db: DatabaseClient,
  entityType: LabelEntityType,
  entityId: string,
  input: LabelsInput
) => {
  const tags = input.tags ?? []
  const genres = input.genres ?? []
  const labels = [
    ...distinct(tags).map((name, position) => ({ ...label('tag', name), position })),
    ...distinct(genres).map((name, position) => ({ ...label('genre', name), position }))
  ]
  const names = distinct(labels.map((entry) => entry.name))
  const existing = names.length
    ? await db.select().from(labelsTable).where(inArray(labelsTable.name, names))
    : []
  const labelIds = new Map(existing.map((label) => [`${label.kind}:${label.name}`, label.id]))
  const newLabels = labels
    .filter((entry) => !labelIds.has(`${entry.kind}:${entry.name}`))
    .map(({ kind, name }) => ({ kind, name, id: crypto.randomUUID() }))

  if (newLabels.length > 0) {
    await db.insert(labelsTable).values(newLabels).onConflictDoNothing()
  }

  const allLabels = names.length
    ? await db.select().from(labelsTable).where(inArray(labelsTable.name, names))
    : []
  const allIds = new Map(allLabels.map((label) => [`${label.kind}:${label.name}`, label.id]))
  await db.batch([
    db
      .delete(entityLabelsTable)
      .where(
        and(eq(entityLabelsTable.entityType, entityType), eq(entityLabelsTable.entityId, entityId))
      ),
    ...labels.flatMap((entry) => {
      const labelId = allIds.get(`${entry.kind}:${entry.name}`)
      return labelId
        ? [
            db.insert(entityLabelsTable).values({
              entityType,
              entityId,
              labelId,
              position: entry.position
            })
          ]
        : []
    })
  ])
}

export const readEntityLabels = async (
  db: DatabaseClient,
  entityType: LabelEntityType,
  entityId: string
) => {
  const rows = await db
    .select({ kind: labelsTable.kind, name: labelsTable.name })
    .from(entityLabelsTable)
    .innerJoin(labelsTable, eq(entityLabelsTable.labelId, labelsTable.id))
    .where(
      and(eq(entityLabelsTable.entityType, entityType), eq(entityLabelsTable.entityId, entityId))
    )
    .orderBy(asc(labelsTable.kind), asc(entityLabelsTable.position))
  return {
    tags: rows.flatMap((row) => (row.kind === 'tag' ? [row.name] : [])),
    genres: rows.flatMap((row) => (row.kind === 'genre' ? [row.name] : []))
  }
}

export const hasEntityLabel = (
  entityType: LabelEntityType,
  entityId: SQLWrapper,
  name: string
) => sql`EXISTS (
  SELECT 1 FROM entity_labels
  INNER JOIN labels ON labels.id = entity_labels.label_id
  WHERE entity_labels.entity_type = ${entityType}
    AND entity_labels.entity_id = ${entityId}
    AND labels.kind = 'tag'
    AND labels.name = ${name}
)`

export const hasEntityLabelLike = (
  entityType: LabelEntityType,
  entityId: SQLWrapper,
  pattern: string
) => sql`EXISTS (
  SELECT 1 FROM entity_labels
  INNER JOIN labels ON labels.id = entity_labels.label_id
  WHERE entity_labels.entity_type = ${entityType}
    AND entity_labels.entity_id = ${entityId}
    AND labels.kind = 'tag'
    AND lower(labels.name) LIKE ${pattern}
)`

export const projectEntityLabels = async <T extends { id: string }>(
  db: DatabaseClient,
  entityType: LabelEntityType,
  entity: T
) => ({ ...entity, ...(await readEntityLabels(db, entityType, entity.id)) })

export const projectEntityLabelsForRows = async <T extends { id: string }>(
  db: DatabaseClient,
  entityType: LabelEntityType,
  entities: readonly T[]
) => {
  if (entities.length === 0) return []
  const rows = await db
    .select({
      entityId: entityLabelsTable.entityId,
      kind: labelsTable.kind,
      name: labelsTable.name,
      position: entityLabelsTable.position
    })
    .from(entityLabelsTable)
    .innerJoin(labelsTable, eq(entityLabelsTable.labelId, labelsTable.id))
    .where(
      and(
        eq(entityLabelsTable.entityType, entityType),
        inArray(
          entityLabelsTable.entityId,
          entities.map((entity) => entity.id)
        )
      )
    )
    .orderBy(asc(labelsTable.kind), asc(entityLabelsTable.position))
  const labelsByEntityId = new Map<string, { tags: string[]; genres: string[] }>()
  for (const row of rows) {
    const labels = labelsByEntityId.get(row.entityId) ?? { tags: [], genres: [] }
    if (row.kind === 'tag') labels.tags.push(row.name)
    else labels.genres.push(row.name)
    labelsByEntityId.set(row.entityId, labels)
  }
  return entities.map((entity) => ({
    ...entity,
    ...(labelsByEntityId.get(entity.id) ?? { tags: [], genres: [] })
  }))
}
