import { verifyPreviewGrant } from '@gbfm/core/media-preview'
import { eq } from 'drizzle-orm'
import { Layer, Redacted, Schema } from 'effect'
import { afterAll, beforeAll, expect, test } from 'vitest'

import { audioCreators, audioTable } from '@/db/audio.schema'
import { session, user } from '@/db/auth.schema'
import { musicLabelCreatorsTable, musicLabelsTable } from '@/db/music-entity.schema'
import { releasesTable } from '@/db/release.schema'
import { showCreators, showsTable } from '@/db/show.schema'
import { ConfigService, createConfig } from '@/services/config.service'
import { ObjectStoreClient } from '@/services/storage/object-store-client'
import { db, d1 } from '@/test/database'
import { createTestWebHandler } from '@/test/http-handler'

const secret = 'disposable-media-preview-signing-key'

const cdn = 'https://cdn.preview.test'

const path = '/user-content/private/preview-owner/multipart/fixture/18/audio_fixture.mp3'

const artwork = '/user-content/private/preview-owner/image/fixture/cover.png'

const objects = new Set([artwork.slice('/user-content/'.length)])

const unusedStorageOperation = () => Promise.reject(new Error('Unexpected fixture storage call'))

const storage = Layer.succeed(ObjectStoreClient, {
  provider: 'r2',
  putObject: unusedStorageOperation,
  presignPutObject: unusedStorageOperation,
  deleteObject: unusedStorageOperation,
  listObjects: unusedStorageOperation,
  listBuckets: unusedStorageOperation,
  createMultipartUpload: unusedStorageOperation,
  presignUploadPart: unusedStorageOperation,
  completeMultipartUpload: unusedStorageOperation,
  abortMultipartUpload: unusedStorageOperation,
  listMultipartParts: unusedStorageOperation,
  headObject: async (_bucket, key) => (objects.has(key) ? { size: 12, metadata: {} } : null),
  copyObject: async (_bucket, source, key) => {
    if (!objects.has(source)) throw new Error('Missing source')
    objects.add(key)
  },
})

const GrantResponse = Schema.Struct({
  sessionUrl: Schema.String,
  grant: Schema.String,
  expiresAt: Schema.Number,
})

let handler: ReturnType<typeof createTestWebHandler>

beforeAll(async () => {
  handler = createTestWebHandler(
    d1,
    undefined,
    storage,
    undefined,
    Layer.succeed(ConfigService, {
      ...createConfig(),
      urls: { ...createConfig().urls, bucketRouter: cdn },
      mediaPreviewKey: Redacted.make(secret),
    }),
  )
  await db.insert(user).values([
    { id: 'preview-owner', name: 'Owner', email: 'preview-owner@example.test', role: 'creator' },
    {
      id: 'preview-collaborator',
      name: 'Collaborator',
      email: 'preview-collaborator@example.test',
      role: 'creator',
    },
    {
      id: 'preview-stranger',
      name: 'Stranger',
      email: 'preview-stranger@example.test',
      role: 'creator',
    },
    { id: 'preview-admin', name: 'Admin', email: 'preview-admin@example.test', role: 'admin' },
  ])
  await db.insert(session).values(
    ['owner', 'collaborator', 'stranger', 'admin'].map((name) => ({
      id: `preview-session-${name}`,
      userId: `preview-${name}`,
      token: `preview-token-${name}`,
      expiresAt: new Date(Date.now() + 3_600_000),
      updatedAt: new Date(),
    })),
  )
  await db.insert(showsTable).values({
    id: 'preview-show',
    slug: 'preview-show',
    title: 'Preview show',
    content: '',
    draft: true,
    thumbnailUrl: `${cdn}${artwork}`,
  })
  await db.insert(audioTable).values({
    id: 'preview-audio',
    slug: 'preview-audio',
    title: 'Preview fixture',
    type: 'mix',
    content: '',
    draft: true,
    url: `${cdn}${path}`,
    showId: 'preview-show',
  })
  await db.insert(audioCreators).values([
    { audioId: 'preview-audio', creatorId: 'preview-owner' },
    { audioId: 'preview-audio', creatorId: 'preview-collaborator' },
  ])
  await db
    .insert(showCreators)
    .values({ showId: 'preview-show', creatorId: 'preview-collaborator' })
  await db.insert(audioTable).values({
    id: 'attacker-episode',
    slug: 'attacker-episode',
    title: 'Untrusted show association',
    type: 'mix',
    content: '',
    draft: true,
    url: 'https://example.test/own.mp3',
    showId: 'preview-show',
  })
  await db
    .insert(audioCreators)
    .values({ audioId: 'attacker-episode', creatorId: 'preview-stranger' })
  await db
    .insert(musicLabelsTable)
    .values({ id: 'preview-label', slug: 'preview-label', name: 'Fixture label' })
  await db
    .insert(musicLabelCreatorsTable)
    .values({ labelId: 'preview-label', creatorId: 'preview-collaborator' })
  await db.insert(releasesTable).values({
    id: 'preview-release',
    slug: 'preview-release',
    title: 'Draft release',
    labelId: 'preview-label',
    draft: true,
    content: '![Inline](/user-content/private/preview-owner/image/release/inline.png)',
    thumbnailUrl: '/user-content/private/preview-owner/image/release/cover.png',
  })
})

afterAll(async () => {
  await handler.dispose()
})

const request = (url: string, actor?: string) =>
  handler.handler(
    new Request('http://localhost/api/upload/preview', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(actor ? { authorization: `Bearer preview-token-${actor}` } : undefined),
      },
      body: JSON.stringify({ url }),
    }),
  )

test('only the uploader, assigned creator or admin receives an exact five-minute CDN grant', async () => {
  const before = Date.now()

  for (const actor of ['owner', 'collaborator', 'admin']) {
    const response = await request(`${cdn}${path}`, actor)
    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    const value = Schema.decodeUnknownSync(GrantResponse)(await response.json())
    expect(value.sessionUrl).toBe(`${cdn}/preview-session`)
    expect(value.expiresAt).toBeGreaterThanOrEqual(before + 300_000)
    expect(value.expiresAt).toBeLessThanOrEqual(Date.now() + 300_000)
    expect(await verifyPreviewGrant(value.grant, secret, cdn, Date.now())).toEqual({
      path,
      audience: cdn,
      expiresAt: value.expiresAt,
    })
    expect(
      await verifyPreviewGrant(value.grant, secret, 'https://other.preview.test', Date.now()),
    ).toBeNull()
  }

  expect((await request(`${cdn}${path}`, 'stranger')).status).toBe(403)
  expect((await request(`${cdn}${path}`)).status).toBe(401)
})

test('private show artwork requires show authority, not an attacker-controlled episode association', async () => {
  expect((await request(`${cdn}${artwork}`, 'stranger')).status).toBe(403)
  expect((await request(`${cdn}${artwork}`, 'collaborator')).status).toBe(200)
  await db.delete(audioCreators).where(eq(audioCreators.creatorId, 'preview-collaborator'))
  await db.delete(showCreators).where(eq(showCreators.creatorId, 'preview-collaborator'))
  expect((await request(`${cdn}${path}`, 'collaborator')).status).toBe(403)
  expect((await request(`${cdn}${artwork}`, 'collaborator')).status).toBe(403)
})

test('release collaborators can preview attached relative cover and inline image URLs', async () => {
  for (const suffix of ['cover.png', 'inline.png']) {
    const url = `${cdn}/user-content/private/preview-owner/image/release/${suffix}`
    expect((await request(url, 'collaborator')).status).toBe(200)
    expect((await request(url, 'stranger')).status).toBe(403)
  }
})

test('neither arbitrary origins, public files nor another uploader scope can be signed', async () => {
  for (const url of [
    `https://attacker.test${path}`,
    `${cdn}/user-content/public/file.mp3`,
    `${cdn}/mixes/private/preview-owner/file.mp3`,
    `${cdn}${path}#fragment`,
  ])
    expect((await request(url, 'owner')).status).toBe(400)
  expect(
    (await request(`${cdn}/user-content/private/preview-owner-extra/file.mp3`, 'owner')).status,
  ).toBe(403)
})

test('public profile saves publish an owned private avatar and reject another uploader attachment', async () => {
  const update = (actor: string) =>
    handler.handler(
      new Request('http://localhost/api/user/profile', {
        method: 'PATCH',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer preview-token-${actor}`,
        },
        body: JSON.stringify({ image: `${cdn}${artwork}` }),
      }),
    )

  expect((await update('stranger')).status).toBe(401)
  expect(objects.has('public/preview-owner/image/fixture/cover.png')).toBe(false)
  const response = await update('owner')
  expect(response.status).toBe(200)

  const profile = Schema.decodeUnknownSync(Schema.Struct({ avatarUrl: Schema.String }))(
    await response.json(),
  )

  expect(profile.avatarUrl).toBe(`${cdn}/user-content/public/preview-owner/image/fixture/cover.png`)
  expect(objects.has('public/preview-owner/image/fixture/cover.png')).toBe(true)
  expect(objects.has('private/preview-owner/image/fixture/cover.png')).toBe(true)
})
