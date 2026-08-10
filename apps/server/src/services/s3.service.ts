import { Context, Effect, Layer } from 'effect'
import { getErrorMessage, S3Error } from '@/errors'
import {
  ObjectStoreClient,
  type ObjectStoreClient as ObjectStoreClientType
} from '@/services/storage/object-store-client'

export interface S3MultipartPart {
  readonly partNumber: number
  readonly etag: string
  readonly size: number
}

export interface S3MultipartUpload {
  readonly uploadId: string
  readonly key: string
  readonly bucket: string
}

export interface S3ObjectMetadata {
  readonly size: number
  readonly metadata: Readonly<Record<string, string>>
}

export interface S3Service {
  readonly uploadFile: (
    key: string,
    body: Buffer | Uint8Array | Blob | string,
    contentType: string,
    bucketName: string
  ) => Effect.Effect<string, S3Error>
  readonly presignPutObject: (
    key: string,
    contentType: string,
    bucketName: string,
    expiresInSeconds: number
  ) => Effect.Effect<string, S3Error>
  readonly deleteFile: (key: string, bucketName: string) => Effect.Effect<void, S3Error>
  readonly checkExists: (key: string, bucketName: string) => Effect.Effect<boolean, never>
  readonly listObjects: (
    prefix: string,
    bucketName: string
  ) => Effect.Effect<Array<{ key: string; lastModified: Date; size: number }>, S3Error>
  readonly listBuckets: () => Effect.Effect<string[], S3Error>
  readonly createMultipartUpload: (
    key: string,
    contentType: string,
    expectedSize: number,
    bucketName: string
  ) => Effect.Effect<S3MultipartUpload, S3Error>
  readonly getObjectMetadata: (
    key: string,
    bucketName: string
  ) => Effect.Effect<S3ObjectMetadata | null, S3Error>
  readonly presignUploadPart: (
    key: string,
    uploadId: string,
    partNumber: number,
    bucketName: string,
    expiresInSeconds: number
  ) => Effect.Effect<string, S3Error>
  readonly completeMultipartUpload: (
    key: string,
    uploadId: string,
    parts: ReadonlyArray<{ partNumber: number; etag: string }>,
    bucketName: string
  ) => Effect.Effect<{ key: string; bucket: string }, S3Error>
  readonly abortMultipartUpload: (
    key: string,
    uploadId: string,
    bucketName: string
  ) => Effect.Effect<void, S3Error>
  readonly listMultipartParts: (
    key: string,
    uploadId: string,
    bucketName: string
  ) => Effect.Effect<S3MultipartPart[], S3Error>
}

export const S3Service = Context.Service<S3Service>('S3Service')

const getKeyPrefix = (key: string): string => key.split('/')[0] ?? 'root'

const storageError = (operation: string, key: string, error: unknown) =>
  new S3Error({
    message: `Failed to ${operation}: ${getErrorMessage(error)}`,
    operation,
    key
  })

const uploadFileEffect = (
  store: ObjectStoreClientType,
  key: string,
  body: Buffer | Uint8Array | Blob | string,
  contentType: string,
  bucketName: string
) =>
  Effect.tryPromise({
    try: async () => {
      await store.putObject({ bucketName, key, body, contentType })
      return key
    },
    catch: (error) => storageError('upload', key, error)
  }).pipe(
    Effect.withSpan('storage.putObject', {
      attributes: {
        'storage.provider': store.provider,
        'storage.bucket': bucketName,
        'storage.key_prefix': getKeyPrefix(key),
        'content.type': contentType
      }
    })
  )

const presignPutObjectEffect = (
  store: ObjectStoreClientType,
  key: string,
  contentType: string,
  bucketName: string,
  expiresInSeconds: number
) =>
  Effect.tryPromise({
    try: () => store.presignPutObject({ bucketName, key, contentType, expiresInSeconds }),
    catch: (error) => storageError('presign put object', key, error)
  }).pipe(
    Effect.withSpan('storage.presignPutObject', {
      attributes: {
        'storage.provider': store.provider,
        'storage.bucket': bucketName,
        'storage.key_prefix': getKeyPrefix(key),
        'content.type': contentType
      }
    })
  )

const deleteFileEffect = (store: ObjectStoreClientType, key: string, bucketName: string) =>
  Effect.tryPromise({
    try: () => store.deleteObject(bucketName, key),
    catch: (error) => storageError('delete', key, error)
  }).pipe(
    Effect.withSpan('storage.deleteObject', {
      attributes: {
        'storage.provider': store.provider,
        'storage.bucket': bucketName,
        'storage.key_prefix': getKeyPrefix(key)
      }
    })
  )

const checkExistsEffect = (store: ObjectStoreClientType, key: string, bucketName: string) =>
  Effect.tryPromise(() => store.headObject(bucketName, key)).pipe(
    Effect.map((object) => object !== null),
    Effect.catch(() => Effect.succeed(false)),
    Effect.withSpan('storage.headObject', {
      attributes: {
        'storage.provider': store.provider,
        'storage.bucket': bucketName,
        'storage.key_prefix': getKeyPrefix(key)
      }
    })
  )

const listObjectsEffect = (store: ObjectStoreClientType, prefix: string, bucketName: string) =>
  Effect.tryPromise({
    try: () => store.listObjects(bucketName, prefix),
    catch: (error) => storageError('list objects', prefix, error)
  }).pipe(
    Effect.withSpan('storage.listObjects', {
      attributes: {
        'storage.provider': store.provider,
        'storage.bucket': bucketName,
        'storage.prefix': prefix
      }
    })
  )

const listBucketsEffect = (store: ObjectStoreClientType) =>
  Effect.tryPromise({
    try: () => store.listBuckets(),
    catch: (error) => storageError('list buckets', 'buckets', error)
  }).pipe(
    Effect.withSpan('storage.listBuckets', { attributes: { 'storage.provider': store.provider } })
  )

const createMultipartUploadEffect = (
  store: ObjectStoreClientType,
  key: string,
  contentType: string,
  expectedSize: number,
  bucketName: string
) =>
  Effect.tryPromise({
    try: async () => {
      const uploadId = await store.createMultipartUpload({
        bucketName,
        key,
        contentType,
        expectedSize
      })
      return { uploadId, key, bucket: bucketName } satisfies S3MultipartUpload
    },
    catch: (error) => storageError('create multipart upload', key, error)
  }).pipe(
    Effect.withSpan('storage.createMultipartUpload', {
      attributes: {
        'storage.provider': store.provider,
        'storage.bucket': bucketName,
        'storage.key_prefix': getKeyPrefix(key),
        'content.type': contentType
      }
    })
  )

const getObjectMetadataEffect = (store: ObjectStoreClientType, key: string, bucketName: string) =>
  Effect.tryPromise({
    try: () => store.headObject(bucketName, key),
    catch: (error) => storageError('inspect object', key, error)
  }).pipe(
    Effect.withSpan('storage.headObjectMetadata', {
      attributes: {
        'storage.provider': store.provider,
        'storage.bucket': bucketName,
        'storage.key_prefix': getKeyPrefix(key)
      }
    })
  )

const presignUploadPartEffect = (
  store: ObjectStoreClientType,
  key: string,
  uploadId: string,
  partNumber: number,
  bucketName: string,
  expiresInSeconds: number
) =>
  Effect.tryPromise({
    try: () => store.presignUploadPart({ bucketName, key, uploadId, partNumber, expiresInSeconds }),
    catch: (error) => storageError('presign upload part', key, error)
  }).pipe(
    Effect.withSpan('storage.presignUploadPart', {
      attributes: {
        'storage.provider': store.provider,
        'storage.bucket': bucketName,
        'storage.key_prefix': getKeyPrefix(key),
        'storage.part_number': partNumber
      }
    })
  )

const completeMultipartUploadEffect = (
  store: ObjectStoreClientType,
  key: string,
  uploadId: string,
  parts: ReadonlyArray<{ partNumber: number; etag: string }>,
  bucketName: string
) =>
  Effect.tryPromise({
    try: async () => {
      await store.completeMultipartUpload({ bucketName, key, uploadId, parts })
      return { key, bucket: bucketName }
    },
    catch: (error) => storageError('complete multipart upload', key, error)
  }).pipe(
    Effect.withSpan('storage.completeMultipartUpload', {
      attributes: {
        'storage.provider': store.provider,
        'storage.bucket': bucketName,
        'storage.key_prefix': getKeyPrefix(key),
        'storage.part_count': parts.length
      }
    })
  )

const abortMultipartUploadEffect = (
  store: ObjectStoreClientType,
  key: string,
  uploadId: string,
  bucketName: string
) =>
  Effect.tryPromise({
    try: () => store.abortMultipartUpload(bucketName, key, uploadId),
    catch: (error) => storageError('abort multipart upload', key, error)
  }).pipe(
    Effect.withSpan('storage.abortMultipartUpload', {
      attributes: {
        'storage.provider': store.provider,
        'storage.bucket': bucketName,
        'storage.key_prefix': getKeyPrefix(key)
      }
    })
  )

const listMultipartPartsEffect = (
  store: ObjectStoreClientType,
  key: string,
  uploadId: string,
  bucketName: string
) =>
  Effect.tryPromise({
    try: () => store.listMultipartParts(bucketName, key, uploadId),
    catch: (error) => storageError('list multipart parts', key, error)
  }).pipe(
    Effect.withSpan('storage.listMultipartParts', {
      attributes: {
        'storage.provider': store.provider,
        'storage.bucket': bucketName,
        'storage.key_prefix': getKeyPrefix(key)
      }
    })
  )

export const S3ServiceLayer = Layer.effect(
  S3Service,
  Effect.gen(function* () {
    const store = yield* ObjectStoreClient

    return {
      uploadFile: (key, body, contentType, bucketName) =>
        uploadFileEffect(store, key, body, contentType, bucketName),
      presignPutObject: (key, contentType, bucketName, expiresInSeconds) =>
        presignPutObjectEffect(store, key, contentType, bucketName, expiresInSeconds),
      deleteFile: (key, bucketName) => deleteFileEffect(store, key, bucketName),
      checkExists: (key, bucketName) => checkExistsEffect(store, key, bucketName),
      listObjects: (prefix, bucketName) => listObjectsEffect(store, prefix, bucketName),
      listBuckets: () => listBucketsEffect(store),
      createMultipartUpload: (key, contentType, expectedSize, bucketName) =>
        createMultipartUploadEffect(store, key, contentType, expectedSize, bucketName),
      getObjectMetadata: (key, bucketName) => getObjectMetadataEffect(store, key, bucketName),
      presignUploadPart: (key, uploadId, partNumber, bucketName, expiresInSeconds) =>
        presignUploadPartEffect(store, key, uploadId, partNumber, bucketName, expiresInSeconds),
      completeMultipartUpload: (key, uploadId, parts, bucketName) =>
        completeMultipartUploadEffect(store, key, uploadId, parts, bucketName),
      abortMultipartUpload: (key, uploadId, bucketName) =>
        abortMultipartUploadEffect(store, key, uploadId, bucketName),
      listMultipartParts: (key, uploadId, bucketName) =>
        listMultipartPartsEffect(store, key, uploadId, bucketName)
    } satisfies S3Service
  })
)
