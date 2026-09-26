import { describe, expect, test } from 'vitest'

import { applyD1Migrations, createMigratedD1Database } from '@/test/migrate-d1'

describe('canonical audio URL migration', () => {
  test('rewrites retired CDN URLs without changing other audio hosts', async () => {
    await using d1Resource = await createMigratedD1Database(['0000_public_thunderbolt.sql'])

    const d1 = d1Resource.database

    await d1.batch([
      d1
        .prepare(
          `INSERT INTO audio (
            id, title, slug, createdAt, updatedAt, content, type, url
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          'legacy-mix',
          'Legacy mix',
          'legacy-mix',
          0,
          0,
          '',
          'mix',
          'https://cdn.dev.goosebumps.fm/user-content/legacy.mp3',
        ),
      d1
        .prepare(
          `INSERT INTO audio (
            id, title, slug, createdAt, updatedAt, content, type, url
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          'external-mix',
          'External mix',
          'external-mix',
          0,
          0,
          '',
          'mix',
          'https://audio.example.com/external.mp3',
        ),
    ])

    await applyD1Migrations(d1, ['0008_canonical_audio_urls.sql'])

    const result = await d1
      .prepare('SELECT id, url FROM audio ORDER BY id')
      .all<{ id: string; url: string }>()

    expect(result.results).toEqual([
      { id: 'external-mix', url: 'https://audio.example.com/external.mp3' },
      { id: 'legacy-mix', url: 'https://cdn.goosebumps.fm/user-content/legacy.mp3' },
    ])
  })
})
