import { drizzle } from 'drizzle-orm/d1'
import { Effect, Layer, Result } from 'effect'
import { beforeAll, describe, expect, test } from 'vitest'

import { audioCreators, audioTable } from '@/db/audio.schema'
import { user } from '@/db/auth.schema'
import * as schema from '@/db/exports'
import { readEntityLabels } from '@/db/labels'
import { Database } from '@/db/layer'
import { entityLabelsTable, labelsTable } from '@/db/tags.schema'
import { NotFoundError, UnauthorizedError } from '@/errors'
import { MdxServiceLayer } from '@/lib/mdx'
import { db, d1 } from '@/test/database'
import { withTestLayer } from '@/test/effect'

import { AudioService, AudioServiceLayer } from './audio.service'
import { ConfigServiceLayer } from './config.service'
import { UploadAssetServiceLayer } from './upload-asset.service'

const owner = { userId: 'audio-read-owner', userRole: 'user' }

const other = { userId: 'audio-read-other', userRole: 'user' }

const admin = { ...other, userRole: 'admin' }

const read = async (slug: string, actor?: typeof owner, edit = false) => {
  const statements: Array<string> = []

  const client = drizzle(d1, {
    schema,
    logger: { logQuery: (query) => statements.push(query) },
  })

  const layer = AudioServiceLayer.pipe(
    Layer.provide(MdxServiceLayer),
    Layer.provide(Layer.mergeAll(ConfigServiceLayer, UploadAssetServiceLayer)),
    Layer.provide(Layer.succeed(Database, client)),
  )

  const result = await Effect.runPromise(
    withTestLayer(
      Effect.gen(function* () {
        const service = yield* AudioService

        return yield* edit && actor
          ? service.getBySlugForEdit('mix', slug, actor.userId, actor.userRole)
          : service.getBySlug('mix', slug, actor)
      }).pipe(Effect.result),
      layer,
    ),
  )

  return { result, statements }
}

beforeAll(async () => {
  await db.insert(user).values([
    { id: owner.userId, name: 'Owner', email: 'audio-read-owner@example.com' },
    { id: other.userId, name: 'Other', email: 'audio-read-other@example.com' },
  ])

  for (const slug of ['ordered', 'empty', 'genre-only', 'draft']) {
    const id = `audio-read-${slug}`
    await db.insert(audioTable).values({
      id,
      slug: id,
      title: id,
      type: 'mix',
      url: 'https://example.com/fixture.mp3',
      content: '',
      draft: slug === 'draft',
    })
    await db.insert(audioCreators).values({ audioId: id, creatorId: owner.userId })
  }

  await db.insert(audioCreators).values({
    audioId: 'audio-read-ordered',
    creatorId: other.userId,
  })
  await db.insert(labelsTable).values([
    { id: 'audio-read-tag-a', kind: 'tag', name: 'zebra "quoted" 🎵' },
    { id: 'audio-read-tag-b', kind: 'tag', name: 'alpha\nline' },
    { id: 'audio-read-genre', kind: 'genre', name: 'audio-read-genre' },
    { id: 'audio-read-show-tag', kind: 'tag', name: 'audio-read-show-only' },
  ])
  await db.insert(entityLabelsTable).values([
    {
      entityType: 'audio',
      entityId: 'audio-read-ordered',
      labelId: 'audio-read-tag-b',
      position: 9,
    },
    {
      entityType: 'audio',
      entityId: 'audio-read-ordered',
      labelId: 'audio-read-tag-a',
      position: 2,
    },
    {
      entityType: 'audio',
      entityId: 'audio-read-ordered',
      labelId: 'audio-read-genre',
      position: 0,
    },
    {
      entityType: 'show',
      entityId: 'audio-read-ordered',
      labelId: 'audio-read-show-tag',
      position: 0,
    },
    {
      entityType: 'audio',
      entityId: 'audio-read-genre-only',
      labelId: 'audio-read-genre',
      position: 0,
    },
    { entityType: 'audio', entityId: 'audio-read-draft', labelId: 'audio-read-tag-b', position: 0 },
  ])
})

describe('AudioService single-query label projection on disposable D1', () => {
  test('preserves ordered tags and creators without a label round trip', async () => {
    const { result, statements } = await read('audio-read-ordered')
    const expected = await readEntityLabels(db, 'audio', 'audio-read-ordered')

    expect(result).toMatchObject({
      success: {
        tags: expected.tags,
        creators: expect.arrayContaining([
          expect.objectContaining({ id: owner.userId }),
          expect.objectContaining({ id: other.userId }),
        ]),
      },
    })
    expect(expected.tags).toEqual(['zebra "quoted" 🎵', 'alpha\nline'])
    expect(statements).toHaveLength(1)
  })

  test.each(['empty', 'genre-only'])('returns null tags for %s audio', async (slug) => {
    const { result, statements } = await read(`audio-read-${slug}`)

    expect(result).toMatchObject({ success: { tags: null } })
    expect(statements).toHaveLength(1)
  })

  test.each([undefined, other])('excludes unauthorized drafts with actor %j', async (actor) => {
    const { result, statements } = await read('audio-read-draft', actor)

    if (!Result.isFailure(result)) throw new Error('Expected excluded draft')

    expect(result.failure).toBeInstanceOf(NotFoundError)
    expect(statements).toHaveLength(1)
  })

  test.each([owner, admin])('includes drafts and labels for authorized actor %j', async (actor) => {
    const { result, statements } = await read('audio-read-draft', actor)

    expect(result).toMatchObject({ success: { tags: ['alpha\nline'] } })
    expect(statements).toHaveLength(1)
  })

  test('keeps edit authorization after the combined projection', async () => {
    const { result } = await read('audio-read-draft', other, true)

    if (!Result.isFailure(result)) throw new Error('Expected unauthorized edit read')

    expect(result.failure).toBeInstanceOf(UnauthorizedError)
  })
})
