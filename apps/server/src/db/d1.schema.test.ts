import { sql } from 'drizzle-orm'
import { describe, expect, test } from 'vitest'
import { audioTable } from '@/db/audio.schema'
import { entityLabelsTable, labelsTable } from '@/db/tags.schema'
import { projectEntityLabelsForRows, readEntityLabels, replaceEntityLabels } from '@/db/labels'
import { db, d1 } from '@/test/d1'

describe('D1 schema', () => {
  test('round-trips timestamps and booleans and updates search when normalized tags change', async () => {
    const createdAt = new Date('2026-08-09T12:00:00.000Z')
    await db.insert(audioTable).values({
      id: '00000000-0000-4000-8000-000000000001',
      title: 'D1 audio',
      slug: 'd1-audio',
      content: '',
      type: 'mix',
      url: 'https://example.com/audio.mp3',
      createdAt,
      updatedAt: createdAt,
      draft: true
    })

    const row = await db.query.audioTable.findFirst({
      where: (audio, { eq }) => eq(audio.id, '00000000-0000-4000-8000-000000000001')
    })

    expect(row).toMatchObject({ createdAt, updatedAt: createdAt, draft: true })
    await db.insert(labelsTable).values({ id: 'tag-1', kind: 'tag', name: 'ambient' })
    await db.insert(entityLabelsTable).values({
      entityType: 'audio',
      entityId: '00000000-0000-4000-8000-000000000001',
      position: 0,
      labelId: 'tag-1'
    })

    const result = await d1
      .prepare('SELECT rowid FROM audio_fts WHERE audio_fts MATCH ?')
      .bind('mbi')
      .all<{ rowid: number }>()

    expect(result.results).toHaveLength(1)

    await db
      .delete(entityLabelsTable)
      .where(
        sql`${entityLabelsTable.entityType} = 'audio' AND ${entityLabelsTable.entityId} = '00000000-0000-4000-8000-000000000001'`
      )
    const afterDelete = await d1
      .prepare('SELECT rowid FROM audio_fts WHERE audio_fts MATCH ?')
      .bind('mbi')
      .all<{ rowid: number }>()

    expect(afterDelete.results).toHaveLength(0)
  })

  test('projects normalized labels in deterministic order', async () => {
    await replaceEntityLabels(db, 'artist', 'artist-1', {
      tags: ['second', 'first'],
      genres: ['electronic', 'ambient']
    })

    await expect(readEntityLabels(db, 'artist', 'artist-1')).resolves.toEqual({
      tags: ['second', 'first'],
      genres: ['electronic', 'ambient']
    })
  })

  test('returns null, not an empty array, for an entity with no tags or genres', async () => {
    await expect(readEntityLabels(db, 'artist', 'artist-untagged')).resolves.toEqual({
      tags: null,
      genres: null
    })
  })

  test('projectEntityLabelsForRows returns null for entities with no labels alongside entities that have some', async () => {
    await replaceEntityLabels(db, 'artist', 'artist-with-genres', {
      genres: ['ambient']
    })

    const projected = await projectEntityLabelsForRows(db, 'artist', [
      { id: 'artist-with-genres' },
      { id: 'artist-without-genres' }
    ])

    expect(projected).toEqual([
      { id: 'artist-with-genres', tags: null, genres: ['ambient'] },
      { id: 'artist-without-genres', tags: null, genres: null }
    ])
  })
})
