import { drizzle } from 'drizzle-orm/d1'
import { Effect, Layer, Result } from 'effect'
import { beforeAll, describe, expect, test } from 'vitest'

import { audioTable } from '@/db/audio.schema'
import { user } from '@/db/auth.schema'
import * as schema from '@/db/exports'
import { readEntityLabels } from '@/db/labels'
import { Database } from '@/db/layer'
import { showCreators, showsTable } from '@/db/show.schema'
import { entityLabelsTable, labelsTable } from '@/db/tags.schema'
import { NotFoundError, UnauthorizedError } from '@/errors'
import { MdxServiceLayer } from '@/lib/mdx'
import { db, d1 } from '@/test/database'
import { withTestLayer } from '@/test/effect'

import { ShowService, ShowServiceLayer } from './show.service'

const owner = { userId: 'show-read-owner', userRole: 'user' }

const other = { userId: 'show-read-other', userRole: 'user' }

const read = async <A, E>(operation: (service: ShowService) => Effect.Effect<A, E>) => {
  const statements: Array<string> = []

  const client = drizzle(d1, {
    schema,
    logger: { logQuery: (query) => statements.push(query) },
  })

  const layer = ShowServiceLayer.pipe(
    Layer.provide(MdxServiceLayer),
    Layer.provide(Layer.succeed(Database, client)),
  )

  const result = await Effect.runPromise(
    withTestLayer(
      Effect.gen(function* () {
        const service = yield* ShowService

        return yield* operation(service)
      }).pipe(Effect.result),
      layer,
    ),
  )

  return { result, statements }
}

beforeAll(async () => {
  await db.insert(user).values([
    { id: owner.userId, name: 'Owner', email: 'show-read-owner@example.com' },
    { id: other.userId, name: 'Other', email: 'show-read-other@example.com' },
  ])

  for (const name of ['ordered', 'empty', 'genre-only', 'draft', 'other', 'other-draft']) {
    const id = `show-read-${name}`
    await db
      .insert(showsTable)
      .values({ id, slug: id, title: id, content: '', draft: name.includes('draft') })
    await db
      .insert(showCreators)
      .values({ showId: id, creatorId: name.startsWith('other') ? other.userId : owner.userId })
  }

  await db.insert(labelsTable).values([
    { id: 'show-read-tag-a', kind: 'tag', name: 'zebra "quoted" 🎵' },
    { id: 'show-read-tag-b', kind: 'tag', name: 'alpha\nline' },
    { id: 'show-read-genre', kind: 'genre', name: 'show-read-genre' },
    { id: 'show-read-audio-tag', kind: 'tag', name: 'audio-only' },
  ])
  await db.insert(entityLabelsTable).values([
    { entityType: 'show', entityId: 'show-read-ordered', labelId: 'show-read-tag-b', position: 9 },
    { entityType: 'show', entityId: 'show-read-ordered', labelId: 'show-read-tag-a', position: 2 },
    { entityType: 'show', entityId: 'show-read-ordered', labelId: 'show-read-genre', position: 0 },
    {
      entityType: 'show',
      entityId: 'show-read-genre-only',
      labelId: 'show-read-genre',
      position: 0,
    },
    { entityType: 'show', entityId: 'show-read-draft', labelId: 'show-read-tag-b', position: 0 },
    {
      entityType: 'audio',
      entityId: 'show-read-ordered',
      labelId: 'show-read-audio-tag',
      position: 0,
    },
    { entityType: 'audio', entityId: 'show-read-ordered', labelId: 'show-read-tag-a', position: 3 },
  ])

  for (const [index, name] of ['ordered', 'empty', 'genre-only', 'draft', 'unrelated'].entries()) {
    const id = `show-read-${name}`
    await db.insert(audioTable).values({
      id,
      slug: id,
      title: id,
      content: '',
      type: 'mix',
      url: 'https://example.com/fixture.mp3',
      showId: name === 'unrelated' ? 'show-read-other' : 'show-read-ordered',
      draft: name === 'draft',
      createdAt: new Date(Date.UTC(2026, 0, index + 1)),
    })
  }

  await db.insert(entityLabelsTable).values([
    {
      entityType: 'audio',
      entityId: 'show-read-genre-only',
      labelId: 'show-read-genre',
      position: 0,
    },
    {
      entityType: 'audio',
      entityId: 'show-read-draft',
      labelId: 'show-read-audio-tag',
      position: 0,
    },
  ])
})

describe('ShowService combined label reads on disposable D1', () => {
  test('show detail reads ordered tags in one statement without cross-entity labels or projection fields', async () => {
    const { result, statements } = await read((service) => service.getBySlug('show-read-ordered'))
    const expected = await readEntityLabels(db, 'show', 'show-read-ordered')

    expect(result).toMatchObject({
      success: {
        tags: expected.tags,
        hosts: [{ id: owner.userId, name: 'Owner', username: null }],
      },
    })
    expect(expected.tags).toEqual(['zebra "quoted" 🎵', 'alpha\nline'])
    expect(statements).toHaveLength(1)

    if (!Result.isSuccess(result)) throw new Error('Expected show')
    expect(result.success).not.toHaveProperty('tagsJson')
  })

  test.each(['empty', 'genre-only'])('show detail keeps null tags for %s shows', async (name) => {
    const { result, statements } = await read((service) => service.getBySlug(`show-read-${name}`))

    expect(result).toMatchObject({ success: { tags: null } })
    expect(statements).toHaveLength(1)
  })

  test('public listing retains counts, pagination and per-row tags with just count and list statements', async () => {
    const { result, statements } = await read((service) =>
      service.getAll({ limit: 100, offset: 0 }),
    )

    if (!Result.isSuccess(result)) throw new Error('Expected listing')
    expect(statements).toHaveLength(2)
    expect(result.success.pagination).toEqual({ total: 4, limit: 100, offset: 0, hasMore: false })
    expect(result.success.data.find((show) => show.id === 'show-read-ordered')?.tags).toEqual([
      'zebra "quoted" 🎵',
      'alpha\nline',
    ])
    expect(result.success.data.find((show) => show.id === 'show-read-genre-only')?.tags).toBeNull()
    expect(result.success.data.some((show) => show.draft)).toBe(false)
    expect(result.success.data.every((show) => !('tagsJson' in show))).toBe(true)

    const paginated = await read((service) => service.getAll({ limit: 1, offset: 2 }))

    expect(paginated.result).toMatchObject({
      success: {
        data: [result.success.data[2]],
        pagination: { total: 4, limit: 1, offset: 2, hasMore: true },
      },
    })
    expect(paginated.statements).toHaveLength(2)
  })

  test('navigation uses one statement with public labels and no count', async () => {
    const { result, statements } = await read((service) => service.getNavigationShows)

    if (!Result.isSuccess(result)) throw new Error('Expected navigation')
    expect(statements).toHaveLength(1)
    expect(result.success).toHaveLength(4)
    expect(result.success.find((show) => show.id === 'show-read-ordered')?.tags).toEqual([
      'zebra "quoted" 🎵',
      'alpha\nline',
    ])
    expect(result.success.some((show) => show.draft)).toBe(false)
  })

  test('management listing keeps ownership and admin visibility with labels and counts', async () => {
    const own = await read((service) =>
      service.getAllForEdit({ limit: 100, offset: 0 }, owner.userId, owner.userRole),
    )

    const admin = await read((service) =>
      service.getAllForEdit({ limit: 100, offset: 0 }, other.userId, 'admin'),
    )

    if (!Result.isSuccess(own.result) || !Result.isSuccess(admin.result))
      throw new Error('Expected listings')
    expect(own.statements).toHaveLength(2)
    expect(admin.statements).toHaveLength(2)
    expect(own.result.success.pagination.total).toBe(4)
    expect(admin.result.success.pagination.total).toBe(6)
    expect(own.result.success.data.some((show) => show.slug.startsWith('show-read-other'))).toBe(
      false,
    )
    expect(own.result.success.data.find((show) => show.id === 'show-read-draft')?.tags).toEqual([
      'alpha\nline',
    ])
    expect(
      admin.result.success.data.find((show) => show.id === 'show-read-other-draft'),
    ).toBeDefined()
  })

  test('public draft exclusion and edit authorization remain unchanged', async () => {
    const publicDraft = await read((service) => service.getBySlug('show-read-draft'))

    const unrelated = await read((service) =>
      service.getBySlugForEdit('show-read-draft', other.userId, other.userRole),
    )

    const own = await read((service) =>
      service.getBySlugForEdit('show-read-draft', owner.userId, owner.userRole),
    )

    const admin = await read((service) =>
      service.getBySlugForEdit('show-read-draft', other.userId, 'admin'),
    )

    if (!Result.isFailure(publicDraft.result) || !Result.isFailure(unrelated.result))
      throw new Error('Expected excluded reads')
    expect(publicDraft.result.failure).toBeInstanceOf(NotFoundError)
    expect(unrelated.result.failure).toBeInstanceOf(UnauthorizedError)
    expect(own.result).toMatchObject({ success: { tags: ['alpha\nline'] } })
    expect(admin.result).toMatchObject({ success: { tags: ['alpha\nline'] } })
  })

  test('episodes project audio labels without extra reads and retain ordering, isolation and visibility', async () => {
    const loaded = await read((service) => service.getBySlug('show-read-ordered'))

    if (!Result.isSuccess(loaded.result)) throw new Error('Expected loaded show')
    const show = loaded.result.success

    const page = await read((service) =>
      service.getEpisodesForShow(show, { limit: 100, offset: 0 }),
    )

    const legacy = await read((service) =>
      service.getEpisodes(show.slug, { limit: 100, offset: 0 }),
    )

    const admin = await read((service) =>
      service.getEpisodesForShow(show, { limit: 100, offset: 0 }, { ...other, userRole: 'admin' }),
    )

    if (!Result.isSuccess(page.result) || !Result.isSuccess(admin.result))
      throw new Error('Expected episodes')
    expect(page.statements).toHaveLength(2)
    expect(legacy.statements).toHaveLength(3)
    expect(legacy.result).toEqual(page.result)
    expect(page.result.success.data.map((episode) => episode.id)).toEqual([
      'show-read-genre-only',
      'show-read-empty',
      'show-read-ordered',
    ])
    expect(
      page.result.success.data.find((episode) => episode.id === 'show-read-ordered')?.tags,
    ).toEqual(['audio-only', 'zebra "quoted" 🎵'])
    expect(
      page.result.success.data.find((episode) => episode.id === 'show-read-empty')?.tags,
    ).toBeNull()
    expect(
      page.result.success.data.find((episode) => episode.id === 'show-read-genre-only')?.tags,
    ).toBeNull()
    expect(page.result.success.data.some((episode) => episode.id === 'show-read-unrelated')).toBe(
      false,
    )
    expect(page.result.success.data.every((episode) => !('tagsJson' in episode))).toBe(true)
    expect(page.result.success.pagination.total).toBe(3)
    expect(admin.result.success.pagination.total).toBe(4)
    expect(admin.result.success.data.find((episode) => episode.draft)?.tags).toEqual(['audio-only'])
  })

  test('a full 100-show dial has no label batching round trips and the listing count remains exact', async () => {
    for (let offset = 0; offset < 100; offset += 5) {
      await db.insert(showsTable).values(
        Array.from({ length: 5 }, (_, index) => ({
          id: `show-read-bounded-${offset + index}`,
          slug: `show-read-bounded-${offset + index}`,
          title: 'Bounded dial fixture',
          content: '',
        })),
      )
    }

    const navigation = await read((service) => service.getNavigationShows)
    const listing = await read((service) => service.getAll({ limit: 100, offset: 0 }))

    if (!Result.isSuccess(navigation.result) || !Result.isSuccess(listing.result))
      throw new Error('Expected bounded listings')
    expect(navigation.result.success).toHaveLength(100)
    expect(navigation.statements).toHaveLength(1)
    expect(listing.result.success.data).toHaveLength(100)
    expect(listing.result.success.pagination).toEqual({
      total: 104,
      limit: 100,
      offset: 0,
      hasMore: true,
    })
    expect(listing.statements).toHaveLength(2)
  })
})
