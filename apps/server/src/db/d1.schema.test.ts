import { sql } from 'drizzle-orm'
import { describe, expect, test } from 'vitest'
import { audioTable } from '@/db/audio.schema'
import { entityLabelsTable, labelsTable } from '@/db/tags.schema'
import { readEntityLabels, replaceEntityLabels } from '@/db/labels'
import { db, d1 } from '@/test/d1'

describe('D1 schema', () => {
  test('round-trips timestamp, boolean, and JSON values', async () => {
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
  })

  test('maintains trigram search after normalized tags change', async () => {
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

  test('keeps partial navigation indexes', async () => {
    const indexes = await d1
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = 'index' AND name LIKE 'navigation_sessions_%_uq'"
      )
      .all<{ name: string }>()

    expect(indexes.results.map((index) => index.name).sort()).toEqual([
      'navigation_sessions_device_uq',
      'navigation_sessions_user_uq'
    ])
  })

  test('matches the release-date ordering fixture', async () => {
    const rows = await db.all<{ title: string }>(sql`
      SELECT title FROM (
        SELECT 'Alpha 2024' AS title, 1717200000000 AS release_date
        UNION ALL SELECT 'Beta 2024', 1717200000000
        UNION ALL SELECT 'Gamma 2022', 1640995200000
        UNION ALL SELECT 'Alpha Null', NULL
        UNION ALL SELECT 'Zulu Null', NULL
      ) ORDER BY release_date IS NULL ASC, release_date DESC, title ASC
    `)

    expect(rows.map((row) => row.title)).toEqual([
      'Alpha 2024',
      'Beta 2024',
      'Gamma 2022',
      'Alpha Null',
      'Zulu Null'
    ])
  })
})
