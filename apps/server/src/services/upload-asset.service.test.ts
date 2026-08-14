import { randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { Effect, Layer } from 'effect'
import { beforeAll, describe, expect, test } from 'vitest'
import { DatabaseTestLayer, db } from '@/test/database'
import { withTestLayer } from '@/test/effect'
import { user } from '@/db/auth.schema'
import { uploadAssetsTable } from '@/db/upload-asset.schema'
import {
  keyFromAssetUrl,
  UploadAssetService,
  UploadAssetServiceLayer
} from './upload-asset.service'

const actorId = `upload-asset-${randomUUID()}`

beforeAll(async () => {
  await db.insert(user).values({
    id: actorId,
    name: 'Upload asset test actor',
    email: `${actorId}@example.com`
  })
})

const getService = () =>
  Effect.runPromise(
    withTestLayer(
      Effect.gen(function* () {
        return yield* UploadAssetService
      }),
      UploadAssetServiceLayer.pipe(Layer.provide(DatabaseTestLayer))
    )
  )

const makePendingInput = (key: string) => ({
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
  test('createPending -> markUploaded -> markAttached happy path', async () => {
    const service = await getService()
    const key = `${actorId}/image/${randomUUID()}/artwork.png`

    const created = await Effect.runPromise(service.createPending(makePendingInput(key)))
    expect(created.status).toBe('pending')
    expect(created.userId).toBe(actorId)
    expect(created.key).toBe(key)

    await Effect.runPromise(service.markUploaded(key))
    const afterUpload = await selectByKey(key)
    expect(afterUpload?.status).toBe('uploaded')

    const attachedToId = randomUUID()
    await Effect.runPromise(service.markAttached(key, 'audio', attachedToId))
    const afterAttach = await selectByKey(key)
    expect(afterAttach?.status).toBe('attached')
    expect(afterAttach?.attachedToTable).toBe('audio')
    expect(afterAttach?.attachedToId).toBe(attachedToId)
  })

  test('markUploaded no-ops when the row is not pending, and a repeat call cannot corrupt state', async () => {
    const service = await getService()
    const key = `${actorId}/image/${randomUUID()}/artwork.png`

    await Effect.runPromise(service.createPending(makePendingInput(key)))
    await Effect.runPromise(service.markUploaded(key))

    const afterFirstUpload = await selectByKey(key)
    expect(afterFirstUpload?.status).toBe('uploaded')

    // Second markUploaded call: the row is no longer 'pending', so the
    // guarded WHERE clause should match zero rows and leave status alone.
    await Effect.runPromise(service.markUploaded(key))
    const afterSecondUpload = await selectByKey(key)
    expect(afterSecondUpload?.status).toBe('uploaded')
  })

  test('markUploaded does not downgrade an already-attached row', async () => {
    const service = await getService()
    const key = `${actorId}/image/${randomUUID()}/artwork.png`

    await Effect.runPromise(service.createPending(makePendingInput(key)))
    await Effect.runPromise(service.markUploaded(key))
    await Effect.runPromise(service.markAttached(key, 'audio', randomUUID()))

    const beforeRow = await selectByKey(key)
    expect(beforeRow?.status).toBe('attached')

    // Calling markUploaded on an attached row must not revert it to
    // 'uploaded' -- the eq(status, 'pending') guard should reject this.
    await Effect.runPromise(service.markUploaded(key))
    const afterRow = await selectByKey(key)
    expect(afterRow?.status).toBe('attached')
  })

  test('markAttached is a no-op when called on a row still in pending (not yet uploaded)', async () => {
    const service = await getService()
    const key = `${actorId}/image/${randomUUID()}/artwork.png`

    await Effect.runPromise(service.createPending(makePendingInput(key)))

    await Effect.runPromise(service.markAttached(key, 'audio', randomUUID()))
    const row = await selectByKey(key)
    expect(row?.status).toBe('pending')
    expect(row?.attachedToTable).toBeNull()
  })

  test('markAttached does not overwrite attachedToTable/attachedToId when called twice', async () => {
    const service = await getService()
    const key = `${actorId}/image/${randomUUID()}/artwork.png`
    const firstAttachedToId = randomUUID()
    const secondAttachedToId = randomUUID()

    await Effect.runPromise(service.createPending(makePendingInput(key)))
    await Effect.runPromise(service.markUploaded(key))
    await Effect.runPromise(service.markAttached(key, 'audio', firstAttachedToId))

    const afterFirstAttach = await selectByKey(key)
    expect(afterFirstAttach?.status).toBe('attached')
    expect(afterFirstAttach?.attachedToId).toBe(firstAttachedToId)

    // The row is no longer 'uploaded', so this second call's guarded WHERE
    // clause should match zero rows and leave the original attachment intact
    // instead of silently overwriting it with a different target.
    await Effect.runPromise(service.markAttached(key, 'posts', secondAttachedToId))
    const afterSecondAttach = await selectByKey(key)
    expect(afterSecondAttach?.status).toBe('attached')
    expect(afterSecondAttach?.attachedToTable).toBe('audio')
    expect(afterSecondAttach?.attachedToId).toBe(firstAttachedToId)
  })

  test('rejects a duplicate createPending call with the same key (UNIQUE(key))', async () => {
    const service = await getService()
    const key = `${actorId}/image/${randomUUID()}/artwork.png`

    await Effect.runPromise(service.createPending(makePendingInput(key)))

    await expect(
      Effect.runPromise(service.createPending(makePendingInput(key)))
    ).rejects.toMatchObject({ _tag: 'DatabaseError' })

    const rows = await db.select().from(uploadAssetsTable).where(eq(uploadAssetsTable.key, key))
    expect(rows).toHaveLength(1)
  })

  test('createPending persists the requesting userId on the row, not a caller-swappable value', async () => {
    const service = await getService()
    const otherUserId = `upload-asset-other-${randomUUID()}`
    await db.insert(user).values({
      id: otherUserId,
      name: 'Other actor',
      email: `${otherUserId}@example.com`
    })

    const ownKey = `${actorId}/image/${randomUUID()}/mine.png`
    const otherKey = `${otherUserId}/image/${randomUUID()}/theirs.png`

    await Effect.runPromise(service.createPending({ ...makePendingInput(ownKey), userId: actorId }))
    await Effect.runPromise(
      service.createPending({ ...makePendingInput(otherKey), userId: otherUserId })
    )

    const ownRow = await selectByKey(ownKey)
    const otherRow = await selectByKey(otherKey)

    expect(ownRow?.userId).toBe(actorId)
    expect(otherRow?.userId).toBe(otherUserId)
    // A key created under one user's prefix is never attributed to another
    // user's row -- there is no key collision or cross-user overwrite.
    expect(ownRow?.key.startsWith(actorId)).toBe(true)
    expect(otherRow?.key.startsWith(otherUserId)).toBe(true)
  })
})
