import { Effect, Layer, Redacted } from 'effect'
import { describe, expect, test } from 'vitest'
import { createConfig, ConfigService } from '../config.service'
import { withTestLayer } from '@/test/effect'
import { ObjectStoreClient } from './object-store-client'
import {
  R2ObjectStoreClientLayer,
  type R2BucketCapability,
  type R2ObjectStoreBuckets
} from './r2-object-store-client'

const config = createConfig()

const makeBucket = () => {
  const puts: Array<{ key: string; contentType: string }> = []
  const deleted: string[] = []
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
            customMetadata: { source: 'test' }
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
                uploaded: new Date('2026-08-10T00:01:00.000Z')
              }
            ],
            truncated: false
          }
        : {
            objects: [
              {
                key: 'prefix/first',
                size: 1,
                uploaded: new Date('2026-08-10T00:00:00.000Z')
              }
            ],
            truncated: true,
            cursor: 'next-page'
          }
    },
    createMultipartUpload: async () => ({ uploadId: 'upload-1' }),
    resumeMultipartUpload: () => ({
      uploadId: 'upload-1',
      complete: async () => {},
      abort: async () => {}
    })
  }
  return { bucket, puts, deleted, cursors }
}

const runWithStore = <A>(
  buckets: R2ObjectStoreBuckets,
  effect: Effect.Effect<A, unknown, ObjectStoreClient>
) => {
  const storage = {
    provider: 'r2' as const,
    accountId: 'test-account',
    endpoint: 'https://test-account.r2.cloudflarestorage.com',
    region: 'auto',
    accessKeyId: Redacted.make('test-access-key'),
    secretAccessKey: Redacted.make('test-secret-key')
  }
  const configLayer = Layer.succeed(ConfigService, { ...config, storage })
  const storeLayer = R2ObjectStoreClientLayer(buckets).pipe(Layer.provide(configLayer))
  return Effect.runPromise(withTestLayer(effect, storeLayer))
}

describe('R2ObjectStoreClientLayer', () => {
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
            contentType: 'text/plain'
          })
        )
        const metadata = yield* Effect.promise(() =>
          store.headObject(config.buckets.userContent, 'prefix/first')
        )
        const objects = yield* Effect.promise(() =>
          store.listObjects(config.buckets.userContent, 'prefix/')
        )
        yield* Effect.promise(() => store.deleteObject(config.buckets.userContent, 'prefix/first'))
        return { metadata, objects }
      })
    )

    expect(userContent.puts).toEqual([{ key: 'prefix/first', contentType: 'text/plain' }])
    expect(userContent.deleted).toEqual(['prefix/first'])
    expect(userContent.cursors).toEqual([undefined, 'next-page'])
    expect(result.metadata).toEqual({ size: 42, metadata: { source: 'test' } })
    expect(result.objects.map((object) => object.key)).toEqual(['prefix/first', 'prefix/second'])
  })
})
