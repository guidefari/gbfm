import { randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { Effect, Layer } from 'effect'
import { describe, expect, test } from 'vitest'
import { DatabaseTestLayer, db } from '@/test/database'
import { withTestLayer } from '@/test/effect'
import { user } from '@/db/auth.schema'
import { uploadAssetsTable } from '@/db/upload-asset.schema'
import {
  keyFromAssetUrl,
  UploadAssetService,
  UploadAssetServiceLayer
} from './upload-asset.service'

const createActor = async () => {
  const actorId = `upload-asset-${randomUUID()}`
  await db.insert(user).values({
    id: actorId,
    name: 'Upload asset test actor',
    email: `${actorId}@example.com`
  })
  return actorId
}

const getService = () =>
  Effect.runPromise(
    withTestLayer(
      Effect.gen(function* () {
        return yield* UploadAssetService
      }),
      UploadAssetServiceLayer.pipe(Layer.provide(DatabaseTestLayer))
    )
  )

const makePendingInput = (actorId: string, key: string) => ({
  userId: actorId,
  key,
  bucket: 'test-bucket',
  assetType: 'image' as const,
  expectedSize: 1024,
  expiresInSeconds: 3600
})

const selectByKey = async (key: string) => {
  const rows = await db.select().from(uploadAssetsTable).where(eq(uploadAssetsTable.key, key))
  return rows[0]
}

describe('keyFromAssetUrl', () => {
  const bucketRouterUrl = 'https://cdn.goosebumps.fm'

  test('strips the bucket router prefix to recover the raw S3 key', () => {
    expect(
      keyFromAssetUrl(
        'https://cdn.goosebumps.fm/user-content/user123/image/abc-def/artwork.png',
        bucketRouterUrl
      )
    ).toBe('user123/image/abc-def/artwork.png')
  })

  test('returns null for a URL from a different host', () => {
    expect(keyFromAssetUrl('https://example.com/user-content/key.png', bucketRouterUrl)).toBeNull()
  })

  test('returns null for a URL missing the /user-content/ path segment', () => {
    expect(keyFromAssetUrl('https://cdn.goosebumps.fm/mixes/key.mp3', bucketRouterUrl)).toBeNull()
  })

  test('returns null for an empty string', () => {
    expect(keyFromAssetUrl('', bucketRouterUrl)).toBeNull()
  })
})

describe('UploadAssetService state machine', () => {
  test('uploads and attaches an asset without premature attachment, downgrades, or reassignment', async () => {
    const actorId = await createActor()
    const service = await getService()
    const key = `${actorId}/image/${randomUUID()}/artwork.png`
    const attachedToId = randomUUID()

    const created = await Effect.runPromise(service.createPending(makePendingInput(actorId, key)))
    expect(created).toMatchObject({ status: 'pending', userId: actorId, key })

    await Effect.runPromise(service.markAttached(key, 'audio', attachedToId))
    expect(await selectByKey(key)).toMatchObject({
      status: 'pending',
      attachedToTable: null,
      attachedToId: null
    })

    await Effect.runPromise(service.markUploaded(key))
    expect(await selectByKey(key)).toMatchObject({ status: 'uploaded' })
    await Effect.runPromise(service.markUploaded(key))
    expect(await selectByKey(key)).toMatchObject({ status: 'uploaded' })

    await Effect.runPromise(service.markAttached(key, 'audio', attachedToId))
    expect(await selectByKey(key)).toMatchObject({
      status: 'attached',
      attachedToTable: 'audio',
      attachedToId
    })
    await Effect.runPromise(service.markUploaded(key))
    expect(await selectByKey(key)).toMatchObject({
      status: 'attached',
      attachedToTable: 'audio',
      attachedToId
    })
    await Effect.runPromise(service.markAttached(key, 'posts', randomUUID()))
    expect(await selectByKey(key)).toMatchObject({
      status: 'attached',
      attachedToTable: 'audio',
      attachedToId
    })
  })

  test('rejects a duplicate createPending call with the same key (UNIQUE(key))', async () => {
    const actorId = await createActor()
    const service = await getService()
    const key = `${actorId}/image/${randomUUID()}/artwork.png`

    await Effect.runPromise(service.createPending(makePendingInput(actorId, key)))

    await expect(
      Effect.runPromise(service.createPending(makePendingInput(actorId, key)))
    ).rejects.toMatchObject({ _tag: 'DatabaseError' })

    const rows = await db.select().from(uploadAssetsTable).where(eq(uploadAssetsTable.key, key))
    expect(rows).toHaveLength(1)
  })
})
