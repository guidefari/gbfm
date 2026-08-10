import { Effect } from 'effect'
import { describe, expect, test } from 'vitest'
import { audioTable } from '@/db/audio.schema'
import { Database } from '@/db/layer'
import { replaceEntityLabels } from '@/db/labels'
import { postsTable } from '@/db/post.schema'
import { SearchService, SearchServiceLayer } from '@/services/search.service'
import { showsTable } from '@/db/show.schema'
import { db, d1 } from '@/test/d1'

const search = (query: string) =>
  Effect.runPromise(
    Effect.gen(function* () {
      const service = yield* SearchService
      return yield* service.search(query, 20)
    }).pipe(Effect.provide(SearchServiceLayer), Effect.provideService(Database, db))
  )

const slugs = (rows: Array<{ slug: string }>) => rows.map((row) => row.slug).toSorted()

describe('D1 search fixture', () => {
  test('matches the captured substring, tag, case, empty, and punctuation result sets', async () => {
    await db.batch([
      db.insert(showsTable).values([
        {
          id: '11111111-1111-1111-1111-111111111111',
          title: 'Aurora Signals',
          slug: 'aurora-signals',
          description: 'Night Signal Dispatch',
          content: 'A transmission from the cosmos.'
        },
        {
          id: '44444444-4444-4444-4444-444444444444',
          title: 'Cinder Club',
          slug: 'cinder-club',
          description: 'Ashes after the broadcast',
          content: 'Embers in the studio.'
        },
        {
          id: '77777777-7777-7777-7777-777777777777',
          title: 'Aurora Draft',
          slug: 'aurora-draft',
          description: 'Unpublished Aurora material',
          content: 'This must be hidden.',
          draft: true
        }
      ]),
      db.insert(audioTable).values([
        {
          id: '22222222-2222-2222-2222-222222222222',
          title: 'Aurora Night Mix',
          slug: 'aurora-night-mix',
          description: 'A midnight waveform.',
          content: 'Signal archive for night listeners.',
          type: 'mix',
          url: 'https://example.com/aurora.mp3'
        },
        {
          id: '55555555-5555-5555-5555-555555555555',
          title: 'Ember Session',
          slug: 'ember-session',
          description: 'Warm analogue tones.',
          content: 'Coals and static.',
          type: 'mix',
          url: 'https://example.com/ember.mp3'
        }
      ]),
      db.insert(postsTable).values([
        {
          id: '33333333-3333-3333-3333-333333333333',
          title: 'Aurora Dispatch',
          slug: 'aurora-dispatch',
          description: 'A field note from the station.',
          content: 'Midnight! Decode the signal.',
          type: 'post'
        },
        {
          id: '66666666-6666-6666-6666-666666666666',
          title: 'Coal Notes',
          slug: 'coal-notes',
          description: 'Warm notes.',
          content: 'Ash and static.',
          type: 'post'
        }
      ])
    ])
    await Promise.all([
      replaceEntityLabels(db, 'show', '11111111-1111-1111-1111-111111111111', {
        tags: ['stargaze']
      }),
      replaceEntityLabels(db, 'show', '44444444-4444-4444-4444-444444444444', { tags: ['fire'] }),
      replaceEntityLabels(db, 'show', '77777777-7777-7777-7777-777777777777', {
        tags: ['stargaze']
      }),
      replaceEntityLabels(db, 'audio', '22222222-2222-2222-2222-222222222222', {
        tags: ['deep-space']
      }),
      replaceEntityLabels(db, 'audio', '55555555-5555-5555-5555-555555555555', { tags: ['fire'] }),
      replaceEntityLabels(db, 'post', '33333333-3333-3333-3333-333333333333', { tags: ['relay'] }),
      replaceEntityLabels(db, 'post', '66666666-6666-6666-6666-666666666666', { tags: ['fire'] })
    ])

    const cases: Array<{ query: string; shows: string[]; audio: string[]; posts: string[] }> = [
      {
        query: 'aurora',
        shows: ['aurora-signals'],
        audio: ['aurora-night-mix'],
        posts: ['aurora-dispatch']
      },
      { query: 'night signal', shows: ['aurora-signals'], audio: [], posts: [] },
      {
        query: 'rora',
        shows: ['aurora-signals'],
        audio: ['aurora-night-mix'],
        posts: ['aurora-dispatch']
      },
      { query: 'stargaze', shows: ['aurora-signals'], audio: [], posts: [] },
      { query: 'deep-space', shows: [], audio: ['aurora-night-mix'], posts: [] },
      { query: 'relay', shows: [], audio: [], posts: ['aurora-dispatch'] },
      {
        query: 'AuRoRa',
        shows: ['aurora-signals'],
        audio: ['aurora-night-mix'],
        posts: ['aurora-dispatch']
      },
      { query: 'midnight!', shows: [], audio: [], posts: ['aurora-dispatch'] }
    ]

    for (const entry of cases) {
      const result = await search(entry.query)
      expect(slugs(result.shows)).toEqual(entry.shows)
      expect(slugs(result.audio)).toEqual(entry.audio)
      expect(slugs(result.posts)).toEqual(entry.posts)
    }

    const empty = await search('')
    expect(slugs(empty.shows)).toEqual(['aurora-signals', 'cinder-club'])
    expect(slugs(empty.audio)).toEqual(['aurora-night-mix', 'ember-session'])
    expect(slugs(empty.posts)).toEqual(['aurora-dispatch', 'coal-notes'])
  })

  test('rolls back a failed batch and rejects a stale playlist revision write', async () => {
    await expect(
      d1.batch([
        d1
          .prepare('INSERT INTO labels (id, kind, name) VALUES (?, ?, ?)')
          .bind('batch-atomicity-label', 'tag', 'batch-atomicity'),
        d1
          .prepare('INSERT INTO labels (id, kind, name) VALUES (?, ?, ?)')
          .bind('batch-atomicity-label', 'tag', 'batch-atomicity-duplicate')
      ])
    ).rejects.toThrow()
    const batchRows = await d1
      .prepare('SELECT count(*) AS count FROM labels WHERE id = ?')
      .bind('batch-atomicity-label')
      .all<{ count: number }>()
    expect(batchRows.results[0]?.count).toBe(0)

    await d1
      .prepare(
        'INSERT INTO music_playlists (id, title, slug, createdAt, updatedAt, revision) VALUES (?, ?, ?, ?, ?, ?)'
      )
      .bind('88888888-8888-8888-8888-888888888888', 'Guarded', 'guarded', 0, 0, 0)
      .run()
    const statement = d1.prepare(
      'UPDATE music_playlists SET revision = revision + 1 WHERE id = ? AND revision = ?'
    )
    const first = await statement.bind('88888888-8888-8888-8888-888888888888', 0).run()
    const stale = await statement.bind('88888888-8888-8888-8888-888888888888', 0).run()
    expect(first.meta.changes).toBe(1)
    expect(stale.meta.changes).toBe(0)
  })
})
