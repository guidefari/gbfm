import { FeaturedMixSettings } from '@gbfm/api/admin'
import { GetAudioByTypeResponse } from '@gbfm/api/audio'
import { eq } from 'drizzle-orm'
import { Schema } from 'effect'
import { afterAll, beforeAll, expect, test } from 'vitest'

import { audioTable } from '@/db/audio.schema'
import { session, user } from '@/db/auth.schema'
import { featuredMixTable } from '@/db/featured-mix.schema'
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

  return Schema.decodeUnknownSync(GetAudioByTypeResponse)(await response.json())
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
  expect(featured.data.map((mix) => mix.id)).toEqual([
    'mix-0',
    ...Array.from({ length: 11 }, (_, i) => `mix-${14 - i}`),
  ])

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
  expect((await settings()).mixId).toBeNull()
  await select('mix-0')
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
