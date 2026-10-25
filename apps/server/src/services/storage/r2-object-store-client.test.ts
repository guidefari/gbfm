import { Effect, Layer, Redacted } from 'effect'
import { Miniflare } from 'miniflare'
import { describe, expect, test } from 'vitest'

import { withTestLayer } from '@/test/effect'

import { createConfig, ConfigService } from '../config.service'
import { ObjectStoreClient } from './object-store-client'
import {
  R2ObjectStoreClientLayer,
  type R2BucketCapability,
  type R2ObjectStoreBuckets,
} from './r2-object-store-client'
import { signedRequest } from './r2-signing'

const config = createConfig()

const makeBucket = () => {
  const puts: Array<{ key: string; contentType: string }> = []
  const deleted: Array<string> = []
  const cursors: Array<string | undefined> = []

  const bucket: R2BucketCapability = {
    put: async (key, _body, options) => {
      puts.push({ key, contentType: options.httpMetadata.contentType })
    },
    head: async (key) =>
      key === 'missing'
        ? null
        : {
            key,
            size: 42,
            uploaded: new Date('2026-08-10T00:00:00.000Z'),
            customMetadata: { source: 'test' },
          },
    delete: async (key) => {
      deleted.push(key)
    },
    list: async (options) => {
      cursors.push(options?.cursor)

      return options?.cursor
        ? {
            objects: [
              {
                key: 'prefix/second',
                size: 2,
                uploaded: new Date('2026-08-10T00:01:00.000Z'),
              },
            ],
            truncated: false,
          }
        : {
            objects: [
              {
                key: 'prefix/first',
                size: 1,
                uploaded: new Date('2026-08-10T00:00:00.000Z'),
              },
            ],
            truncated: true,
            cursor: 'next-page',
          }
    },
    createMultipartUpload: async () => ({ uploadId: 'upload-1' }),
    resumeMultipartUpload: () => ({
      uploadId: 'upload-1',
      complete: async () => {},
      abort: async () => {},
    }),
  }

  return { bucket, puts, deleted, cursors }
}

const runWithStore = <A, E>(
  buckets: R2ObjectStoreBuckets,
  effect: Effect.Effect<A, E, ObjectStoreClient>,
  request?: typeof signedRequest,
) => {
  const storage = {
    provider: 'r2' as const,
    accountId: 'test-account',
    endpoint: 'https://test-account.r2.cloudflarestorage.com',
    region: 'auto',
    accessKeyId: Redacted.make('test-access-key'),
    secretAccessKey: Redacted.make('test-secret-key'),
  }

  const configLayer = Layer.succeed(ConfigService, { ...config, storage })
  const storeLayer = R2ObjectStoreClientLayer(buckets, request).pipe(Layer.provide(configLayer))

  return Effect.runPromise(withTestLayer(effect, storeLayer))
}

describe('R2ObjectStoreClientLayer', () => {
  test('completes a native R2 upload using quoted S3 response ETags', async () => {
    const miniflare = new Miniflare({
      modules: true,
      script: 'export default { fetch() { return new Response("ok") } }',
      r2Buckets: ['UPLOADS'],
      compatibilityDate: '2026-08-01',
    })

    try {
      const bucket = await miniflare.getR2Bucket('UPLOADS')
      const key = 'multipart/test.mp3'
      const upload = await bucket.createMultipartUpload(key)
      const part = await upload.uploadPart(1, new TextEncoder().encode('audio fixture'))

      await runWithStore(
        { userContent: bucket, mixes: bucket },
        Effect.gen(function* () {
          const store = yield* ObjectStoreClient
          yield* Effect.promise(() =>
            store.completeMultipartUpload({
              bucketName: config.buckets.userContent,
              key,
              uploadId: upload.uploadId,
              parts: [{ partNumber: 1, etag: `"${part.etag}"` }],
            }),
          )
        }),
      )

      expect(await (await bucket.get(key))?.text()).toBe('audio fixture')
    } finally {
      await miniflare.dispose()
    }
  })

  test('copies server-side using the signed S3 copy-source header and rejects embedded HTTP 200 errors', async () => {
    const bucket = makeBucket().bucket

    const requests: Array<{
      method: string
      url: string
      source: string | null
      authorization: string | null
    }> = []

    let responseBody = '<CopyObjectResult><ETag>test-etag</ETag></CopyObjectResult>'

    const request: typeof signedRequest = (input) =>
      signedRequest({
        ...input,
        fetch: async (url, init) => {
          const headers = new Headers(init?.headers)
          requests.push({
            method: init?.method ?? 'GET',
            url,
            source: headers.get('x-amz-copy-source'),
            authorization: headers.get('authorization'),
          })

          return new Response(responseBody, { status: 200 })
        },
      })

    const copy = Effect.gen(function* () {
      const store = yield* ObjectStoreClient
      yield* Effect.promise(() =>
        store.copyObject(
          config.buckets.userContent,
          'private/owner/image/id/a b.png',
          'public/owner/image/id/a b.png',
        ),
      )
    })

    await runWithStore({ userContent: bucket, mixes: bucket }, copy, request)
    expect(requests).toHaveLength(1)
    expect(requests[0]).toMatchObject({
      method: 'PUT',
      url: `https://test-account.r2.cloudflarestorage.com/${config.buckets.userContent}/public/owner/image/id/a%20b.png`,
      source: `/${encodeURIComponent(config.buckets.userContent)}/private/owner/image/id/a%20b.png`,
    })
    expect(requests[0]?.authorization).toContain('x-amz-copy-source')
    responseBody = '<Error><Code>InternalError</Code></Error>'
    await expect(
      runWithStore({ userContent: bucket, mixes: bucket }, copy, request),
    ).rejects.toThrow('R2 object copy failed')
  })

  test('uses native bindings for object writes, reads, deletes, and paginated lists', async () => {
    const userContent = makeBucket()
    const mixes = makeBucket()
    const buckets = { userContent: userContent.bucket, mixes: mixes.bucket }

    const result = await runWithStore(
      buckets,
      Effect.gen(function* () {
        const store = yield* ObjectStoreClient
        yield* Effect.promise(() =>
          store.putObject({
            bucketName: config.buckets.userContent,
            key: 'prefix/first',
            body: 'body',
            contentType: 'text/plain',
          }),
        )

        const metadata = yield* Effect.promise(() =>
          store.headObject(config.buckets.userContent, 'prefix/first'),
        )

        const objects = yield* Effect.promise(() =>
          store.listObjects(config.buckets.userContent, 'prefix/'),
        )

        yield* Effect.promise(() => store.deleteObject(config.buckets.userContent, 'prefix/first'))

        return { metadata, objects }
      }),
    )

    expect(userContent.puts).toEqual([{ key: 'prefix/first', contentType: 'text/plain' }])
    expect(userContent.deleted).toEqual(['prefix/first'])
    expect(userContent.cursors).toEqual([undefined, 'next-page'])
    expect(result.metadata).toEqual({ size: 42, metadata: { source: 'test' } })
    expect(result.objects.map((object) => object.key)).toEqual(['prefix/first', 'prefix/second'])
  })
})
