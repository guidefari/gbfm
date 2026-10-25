import { ListeningDocument } from '@gbfm/api/listening'
import { Schema } from 'effect'
import { afterAll, beforeAll, expect, test } from 'vitest'

import { session, user } from '@/db/auth.schema'
import { db, d1 } from '@/test/database'
import { createTestWebHandler } from '@/test/http-handler'

const web = createTestWebHandler(d1)

const request = (path: string, token?: string, method = 'GET', body?: Schema.Json) => {
  const headers = new Headers({ 'content-type': 'application/json' })

  if (token) headers.set('authorization', `Bearer ${token}`)

  const init: RequestInit = { method, headers }

  if (body !== undefined) init.body = JSON.stringify(body)

  return web.handler(new Request(`http://localhost/api/listening${path}`, init))
}

const document = async (path: string, token?: string) => {
  const response = await request(path, token)
  expect(response.status).toBe(200)

  return Schema.decodeUnknownSync(ListeningDocument)(await response.json())
}

const write = async (
  path: string,
  token: string,
  method: string,
  body?: Schema.Json,
  expected = 200,
) => {
  expect((await request(path, token, method, body)).status).toBe(expected)
}

const save = (token: string, url: string, title: string) =>
  write('/mixes', token, 'POST', { items: [{ url, title }] })

beforeAll(async () => {
  for (const id of ['listener-aya', 'listener-ben']) {
    await db.insert(user).values({ id, name: id, email: `${id}@example.test`, role: 'user' })
    await db.insert(session).values({
      id,
      token: id,
      userId: id,
      expiresAt: new Date(Date.now() + 86400000),
      updatedAt: new Date(),
    })
  }
})

afterAll(() => web.dispose())

test('ordinary users own independent libraries; collection visibility never exposes drafts and ownership cannot be forged', async () => {
  const aya = 'listener-aya'
  const ben = 'listener-ben'
  expect((await request('')).status).toBe(401)
  expect((await request('/mixes', undefined, 'POST', { items: [] })).status).not.toBe(200)
  await save(aya, 'https://youtu.be/abcdefghijk?si=tracking', 'Opening frequencies')
  await save(aya, 'https://soundcloud.com/local-radio/late-night', 'Secret backlog')
  await save(ben, 'https://youtu.be/abcdefghijk', 'Ben’s independent save')
  await write('/collections', aya, 'POST', {
    title: 'After hours',
    description: 'Slow transitions',
    published: true,
  })
  await write('/collections', aya, 'POST', {
    title: 'Private experiments',
    description: 'not public',
    published: false,
  })
  await write('/collections', ben, 'POST', {
    title: 'Ben’s collection',
    description: '',
    published: true,
  })
  const library = await document('', aya)
  expect(library.mixes.map((mix) => mix.title).sort()).toEqual([
    'Opening frequencies',
    'Secret backlog',
  ])
  expect(library.mixes.every((mix) => !mix.published && mix.status === 'to-listen')).toBe(true)
  const mix = library.mixes.find((item) => item.title === 'Opening frequencies')
  const draft = library.mixes.find((item) => item.title === 'Secret backlog')
  const collection = library.collections.find((item) => item.title === 'After hours')
  const privateCollection = library.collections.find((item) => !item.published)
  const otherCollection = (await document('', ben)).collections[0]

  if (!mix || !draft || !collection || !privateCollection || !otherCollection)
    throw new Error('Missing fixtures')

  for (const item of [mix, draft])
    await write(`/collections/${collection.id}/mixes/${item.id}`, aya, 'PUT', { included: true })
  await write(`/collections/${collection.id}/mixes/${mix.id}`, aya, 'PUT', { included: true })
  expect((await document('', aya)).memberships).toHaveLength(2)
  expect((await document(`/public/${collection.id}`)).mixes).toEqual([])
  expect((await request(`/public/${privateCollection.id}`, aya)).status).toBe(404)
  expect((await document('/public')).collections.map((item) => item.title)).not.toContain(
    'Private experiments',
  )

  const edit = {
    title: 'Opening frequencies',
    notes: 'The bass enters at 14:20. <script>not HTML</script>',
    status: 'listening',
    published: true,
  }

  await write(`/mixes/${mix.id}`, aya, 'PUT', edit)
  const published = await document(`/public/${collection.id}`)
  expect(published.mixes.map((item) => item.title)).toEqual(['Opening frequencies'])
  expect(published.mixes[0]?.notes).toBe(edit.notes)
  expect(JSON.stringify(published)).not.toContain('Secret backlog')
  expect(published.mixes[0]).not.toHaveProperty('userId')
  await save(
    aya,
    'https://www.youtube.com/watch?v=abcdefghijk&utm_source=repeat',
    'Do not overwrite',
  )
  expect((await document('', aya)).mixes.find((item) => item.id === mix.id)?.notes).toBe(edit.notes)
  expect((await document('', ben)).mixes[0]?.notes).toBe('')

  await write(`/mixes/${mix.id}`, ben, 'PUT', edit, 404)
  await write(`/mixes/${mix.id}`, ben, 'DELETE', undefined, 404)
  await write(
    `/collections/${collection.id}`,
    ben,
    'PUT',
    { title: 'stolen', description: '', published: true },
    404,
  )
  await write(`/collections/${collection.id}`, ben, 'DELETE', undefined, 404)
  await write(
    `/collections/${otherCollection.id}/mixes/${mix.id}`,
    ben,
    'PUT',
    { included: true },
    404,
  )
  await write(`/collections/${collection.id}/mixes/${mix.id}`, ben, 'PUT', { included: false })
  expect((await document('', aya)).memberships).toHaveLength(2)

  await write(
    '/mixes',
    aya,
    'POST',
    {
      items: [
        { url: 'https://youtu.be/12345678901', title: 'Must roll back' },
        { url: 'https://evil.example/mix', title: 'Invalid' },
      ],
    },
    400,
  )
  expect((await document('', aya)).mixes).toHaveLength(2)
  await write(`/mixes/${mix.id}`, aya, 'PUT', { ...edit, published: false })
  expect((await document(`/public/${collection.id}`)).mixes).toEqual([])
  await write(`/mixes/${mix.id}`, aya, 'DELETE')
  expect((await document('', aya)).memberships).toHaveLength(1)
  await write(`/collections/${collection.id}`, aya, 'DELETE')
  expect((await request(`/public/${collection.id}`)).status).toBe(404)
  expect((await document('', aya)).mixes).toHaveLength(1)
  expect((await document('', aya)).memberships).toEqual([])
})

test('bulk capture handles the maximum batch without losing rows and validates boundaries', async () => {
  await write('/mixes', 'listener-ben', 'POST', {
    items: Array.from({ length: 200 }, (_, index) => ({
      url: `https://soundcloud.com/bulk-radio/mix-${index}`,
      title: `Mix ${index}`,
    })),
  })
  expect((await document('', 'listener-ben')).mixes).toHaveLength(201)
  await write(
    '/mixes',
    'listener-ben',
    'POST',
    {
      items: Array.from({ length: 201 }, () => ({
        url: 'https://youtu.be/abcdefghijk',
        title: 'Too many',
      })),
    },
    400,
  )
  await write(
    '/collections',
    'listener-ben',
    'POST',
    { title: '   ', description: '', published: false },
    400,
  )
})
