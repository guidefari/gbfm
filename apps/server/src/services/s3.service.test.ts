import { Effect, Layer } from 'effect'
import { describe, expect, test } from 'vitest'
import { ObjectStoreClient } from './storage/object-store-client'
import { withTestLayer } from '@/test/effect'
import { S3Service, S3ServiceLayer } from './s3.service'

const testStore = () => {
  const uploads: Array<{ bucketName: string; key: string; contentType: string }> = []
  return {
    uploads,
    provider: 'r2' as const,
    putObject: async (input: {
      readonly bucketName: string
      readonly key: string
      readonly body: Uint8Array | Blob | string
      readonly contentType: string
    }) => {
      uploads.push({
        bucketName: input.bucketName,
        key: input.key,
        contentType: input.contentType
      })
    },
    presignPutObject: async () => 'https://object-store.test/upload',
    deleteObject: async () => {},
    headObject: async () => null,
    listObjects: async () => [],
    listBuckets: async () => ['user-content', 'mixes'],
    createMultipartUpload: async () => 'upload-1',
    presignUploadPart: async () => 'https://object-store.test/part',
    completeMultipartUpload: async () => {},
    abortMultipartUpload: async () => {},
    listMultipartParts: async () => []
  }
}

describe('S3Service', () => {
  test('sends object operations through ObjectStoreClient', async () => {
    const store = testStore()
    const serviceLayer = S3ServiceLayer.pipe(Layer.provide(Layer.succeed(ObjectStoreClient, store)))

    const result = await Effect.runPromise(
      withTestLayer(
        Effect.gen(function* () {
          const s3 = yield* S3Service
          yield* s3.uploadFile('path/file.txt', 'hello object store', 'text/plain', 'test-bucket')
          return yield* s3.listBuckets()
        }),
        serviceLayer
      )
    )

    expect(store.uploads).toEqual([
      { bucketName: 'test-bucket', key: 'path/file.txt', contentType: 'text/plain' }
    ])
    expect(result).toEqual(['user-content', 'mixes'])
  })
})
