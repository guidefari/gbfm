import { FeaturedMixSettings } from '@gbfm/api/admin'
import { GetAudioByTypeResponse, HomepageMixesResponse } from '@gbfm/api/audio'
import { and, eq, ne } from 'drizzle-orm'
import { Schema } from 'effect'
import { afterAll, beforeAll, expect, test } from 'vitest'

import { audioCreators, audioTable } from '@/db/audio.schema'
import { session, user } from '@/db/auth.schema'
import { featuredMixTable } from '@/db/featured-mix.schema'
import { showsTable } from '@/db/show.schema'
import { db, d1 } from '@/test/database'
import { createTestWebHandler } from '@/test/http-handler'

const web = createTestWebHandler(d1)

const request = (path: string, token?: string, mixId?: string | null) => {
  const headers = new Headers({ 'content-type': 'application/json' })

  if (token) headers.set('authorization', `Bearer ${token}`)

  return web.handler(
    new Request(`http://localhost${path}`, {
      method: mixId === undefined ? 'GET' : 'PUT',
      headers,
      body: mixId === undefined ? null : JSON.stringify({ mixId }),
    }),
  )
}

const settings = async () =>
  Schema.decodeUnknownSync(FeaturedMixSettings)(
    await (await request('/api/admin/featured-mix', 'featured-admin')).json(),
  )

const homepage = async () => {
  const response = await request('/api/content/homepage-mixes')
  expect(response.status).toBe(200)
  expect(response.headers.get('cache-control')).toBe(
    'public, max-age=60, stale-while-revalidate=300',
  )

  return Schema.decodeUnknownSync(HomepageMixesResponse)(await response.json())
}

const select = async (mixId: string | null, status = 200) => {
  expect((await request('/api/admin/featured-mix', 'featured-admin', mixId)).status).toBe(status)
}

beforeAll(async () => {
  for (const role of ['admin', 'creator', 'editor', 'user']) {
    const id = `featured-${role}`
    await db.insert(user).values({ id, name: role, email: `${id}@example.com`, role })
    await db.insert(session).values({
      id,
      token: id,
      userId: id,
      expiresAt: new Date(Date.now() + 86_400_000),
      updatedAt: new Date(),
    })
  }

  for (let index = 0; index < 15; index++) {
    await db.insert(audioTable).values({
      id: `mix-${index}`,
      slug: `mix-${index}`,
      title: `Mix ${index}`,
      type: 'mix' as const,
      content: '',
      url: 'https://example.com/mix.mp3',
      createdAt: new Date(2026, 0, index + 1),
    })
  }

  await db.insert(showsTable).values({
    id: 'featured-show',
    slug: 'featured-show',
    title: 'Show',
    content: '',
    thumbnailUrl: 'https://example.com/show.jpg',
  })
  await db.update(audioTable).set({ showId: 'featured-show' }).where(eq(audioTable.id, 'mix-0'))
  await db.insert(audioCreators).values({ audioId: 'mix-0', creatorId: 'featured-creator' })
  await db.insert(audioTable).values([
    {
      id: 'draft',
      slug: 'draft',
      title: 'Draft',
      type: 'mix',
      draft: true,
      content: '',
      url: 'https://example.com/draft.mp3',
    },
    {
      id: 'track',
      slug: 'track',
      title: 'Track',
      type: 'track',
      content: '',
      url: 'https://example.com/track.mp3',
    },
  ])
})

afterAll(() => web.dispose())

test('only admins can read or change the selection', async () => {
  for (const role of [undefined, 'creator', 'editor', 'user']) {
    const token = role ? `featured-${role}` : undefined
    const expected = role ? 403 : 401
    expect((await request('/api/admin/featured-mix', token)).status).toBe(expected)
    expect((await request('/api/admin/featured-mix', token, 'mix-0')).status).toBe(expected)
  }

  expect((await settings()).mixId).toBeNull()
})

test('persists an older selection beyond page one, replaces it, rejects invalid choices, and falls back safely', async () => {
  expect((await homepage()).data[0]?.id).toBe('mix-14')
  expect((await settings()).mixes).toHaveLength(15)
  await select('mix-0')
  await select('mix-0') // PUT retries are harmless.
  expect((await settings()).mixId).toBe('mix-0')
  const featured = await homepage()
  expect(featured.data).toEqual([
    {
      id: 'mix-0',
      title: 'Mix 0',
      slug: 'mix-0',
      type: 'mix',
      url: 'https://example.com/mix.mp3',
      thumbnailUrl: 'https://example.com/show.jpg',
      creators: [{ id: 'featured-creator', name: 'creator', username: null }],
    },
  ])
  await db
    .update(audioTable)
    .set({ thumbnailUrl: 'https://example.com/mix.jpg' })
    .where(eq(audioTable.id, 'mix-0'))
  expect((await homepage()).data[0]?.thumbnailUrl).toBe('https://example.com/mix.jpg')

  const regular = Schema.decodeUnknownSync(GetAudioByTypeResponse)(
    await (await request('/api/content/audio/mix')).json(),
  )

  expect(regular.data[0]?.id).toBe('mix-14')

  for (const invalid of ['draft', 'track', 'missing']) {
    await select(invalid, 400)
    expect((await settings()).mixId).toBe('mix-0')
  }

  await select('mix-1')
  expect(await db.select().from(featuredMixTable)).toEqual([{ slot: 1, audioId: 'mix-1' }])
  await db.update(audioTable).set({ draft: true }).where(eq(audioTable.id, 'mix-1'))
  expect((await homepage()).data[0]?.id).toBe('mix-14')
  expect((await settings()).mixId).toBe('mix-1')
  await select('mix-0')
  await db.delete(audioCreators).where(eq(audioCreators.audioId, 'mix-0'))
  await db.delete(audioTable).where(eq(audioTable.id, 'mix-0'))
  expect((await homepage()).data[0]?.id).toBe('mix-14')
  expect(await db.select().from(featuredMixTable)).toEqual([])
  await select('mix-2')
  await select(null)
  expect((await settings()).mixId).toBeNull()
  expect((await homepage()).data[0]?.id).toBe('mix-14')
  await db.update(audioTable).set({ draft: true }).where(eq(audioTable.type, 'mix'))
  expect((await homepage()).data).toEqual([])
})

test('reports an unpublished selection so choosing automatic clears it before republishing', async () => {
  await db
    .update(audioTable)
    .set({ draft: false })
    .where(and(eq(audioTable.type, 'mix'), ne(audioTable.id, 'draft')))
  await select('mix-3')
  await db.update(audioTable).set({ draft: true }).where(eq(audioTable.id, 'mix-3'))

  const unavailable = await settings()
  expect(unavailable.mixId).toBe('mix-3')
  expect(unavailable.unavailableTitle).toBe('Mix 3')
  expect(unavailable.mixes.map(({ id }) => id)).not.toContain('mix-3')
  expect((await homepage()).data[0]?.id).toBe('mix-14')

  await select(null)
  expect(await settings()).toMatchObject({ mixId: null, unavailableTitle: null })
  expect(await db.select().from(featuredMixTable)).toEqual([])

  await db.update(audioTable).set({ draft: false }).where(eq(audioTable.id, 'mix-3'))
  expect((await homepage()).data[0]?.id).toBe('mix-14')
  expect((await settings()).mixId).toBeNull()
})
