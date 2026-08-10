import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  type CompletedPart,
  ListBucketsCommand,
  ListObjectsV2Command,
  ListPartsCommand,
  PutObjectCommand,
  UploadPartCommand
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { Context, Effect, Layer } from 'effect'
import { getErrorMessage, S3Error } from '@/errors'
import { ConfigService } from '@/services/config.service'
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

// Service interface
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

// Service tag for dependency injection
export const S3Service = Context.Service<S3Service>('S3Service')

// Helper to extract key prefix (first segment) for safe logging
const getKeyPrefix = (key: string): string => {
  const parts = key.split('/')
  return (parts.length > 1 ? parts[0] : 'root') ?? 'root'
}

// Core service logic - pure Effects with no service dependencies
const uploadFileEffect = (
  store: ObjectStoreClientType,
  key: string,
  body: Buffer | Uint8Array | Blob | string,
  contentType: string,
  bucketName: string
) =>
  Effect.tryPromise({
    try: async () => {
      const s3 = store.client
      await s3.send(
        new PutObjectCommand({
          Bucket: bucketName,
          Key: key,
          Body: body,
          ContentType: contentType
        })
      )
      return key
    },
    catch: (error) =>
      error instanceof Error
        ? new S3Error({
            message: `Failed to upload file to S3: ${error.message}`,
            operation: 'upload',
            key
          })
        : new S3Error({
            message: `Failed to upload file to S3: Unknown error: ${String(error)}`,
            operation: 'upload',
            key
          })
  }).pipe(
    Effect.tap(() =>
      Effect.annotateCurrentSpan('storage.provider', store.provider).pipe(
        Effect.andThen(Effect.annotateCurrentSpan('aws.service', 's3')),
        Effect.andThen(Effect.annotateCurrentSpan('s3.bucket', bucketName)),
        Effect.andThen(Effect.annotateCurrentSpan('s3.key_prefix', getKeyPrefix(key))),
        Effect.andThen(Effect.annotateCurrentSpan('content.type', contentType)),
        Effect.andThen(
          body instanceof Buffer
            ? Effect.annotateCurrentSpan('payload.size_bytes', body.length)
            : typeof body === 'string'
              ? Effect.annotateCurrentSpan('payload.size_bytes', body.length)
              : Effect.void
        )
      )
    ),
    Effect.withSpan('aws.s3.putObject')
  )

const presignPutObjectEffect = (
  store: ObjectStoreClientType,
  key: string,
  contentType: string,
  bucketName: string,
  expiresInSeconds: number
) =>
  Effect.tryPromise({
    try: async () => {
      const s3 = store.signingClient
      const command = new PutObjectCommand({
        Bucket: bucketName,
        Key: key,
        ContentType: contentType
      })
      return await getSignedUrl(s3, command, { expiresIn: expiresInSeconds })
    },
    catch: (error) =>
      new S3Error({
        message: `Failed to presign put object: ${getErrorMessage(error)}`,
        operation: 'presignPutObject',
        key
      })
  }).pipe(
    Effect.withSpan('aws.s3.presignPutObject', {
      attributes: {
        'storage.provider': store.provider,
        'aws.service': 's3',
        's3.bucket': bucketName,
        's3.key_prefix': getKeyPrefix(key),
        'content.type': contentType
      }
    })
  )

const deleteFileEffect = (store: ObjectStoreClientType, key: string, bucketName: string) =>
  Effect.tryPromise({
    try: async () => {
      const s3 = store.client
      await s3.send(
        new DeleteObjectCommand({
          Bucket: bucketName,
          Key: key
        })
      )
    },
    catch: (error) =>
      error instanceof Error
        ? new S3Error({
            message: `Failed to delete file from S3: ${error.message}`,
            operation: 'delete',
            key
          })
        : new S3Error({
            message: `Failed to delete file from S3: Unknown error: ${String(error)}`,
            operation: 'delete',
            key
          })
  }).pipe(
    Effect.withSpan('aws.s3.deleteObject', {
      attributes: {
        'storage.provider': store.provider,
        'aws.service': 's3',
        's3.bucket': bucketName,
        's3.key_prefix': getKeyPrefix(key)
      }
    })
  )

const checkExistsEffect = (store: ObjectStoreClientType, key: string, bucketName: string) =>
  Effect.tryPromise({
    try: async () => {
      const s3 = store.client
      await s3.send(
        new HeadObjectCommand({
          Bucket: bucketName,
          Key: key
        })
      )
      return true
    },
    catch: () => false
  }).pipe(
    Effect.orElseSucceed(() => false),
    Effect.withSpan('aws.s3.headObject', {
      attributes: {
        'storage.provider': store.provider,
        'aws.service': 's3',
        's3.bucket': bucketName,
        's3.key_prefix': getKeyPrefix(key)
      }
    })
  )

const listObjectsEffect = (store: ObjectStoreClientType, prefix: string, bucketName: string) =>
  Effect.tryPromise({
    try: async () => {
      const s3 = store.client
      const allObjects: Array<{
        key: string
        lastModified: Date
        size: number
      }> = []
      let continuationToken: string | undefined

      do {
        const response = await s3.send(
          new ListObjectsV2Command({
            Bucket: bucketName,
            Prefix: prefix || undefined,
            ContinuationToken: continuationToken
          })
        )
        const page = (response.Contents ?? []).flatMap((obj) => {
          if (!obj.Key || !obj.LastModified) {
            return []
          }

          return [
            {
              key: obj.Key,
              lastModified: obj.LastModified,
              size: obj.Size ?? 0
            }
          ]
        })
        allObjects.push(...page)
        continuationToken = response.IsTruncated ? response.NextContinuationToken : undefined
      } while (continuationToken)

      return allObjects
    },
    catch: (error) =>
      error instanceof Error
        ? new S3Error({
            message: `Failed to list objects from S3: ${error.message}`,
            operation: 'list',
            key: prefix
          })
        : new S3Error({
            message: `Failed to list objects from S3: Unknown error: ${String(error)}`,
            operation: 'list',
            key: prefix
          })
  }).pipe(
    Effect.withSpan('aws.s3.listObjectsV2', {
      attributes: {
        'storage.provider': store.provider,
        'aws.service': 's3',
        's3.bucket': bucketName,
        's3.prefix': prefix
      }
    })
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
      const s3 = store.client
      const response = await s3.send(
        new CreateMultipartUploadCommand({
          Bucket: bucketName,
          Key: key,
          ContentType: contentType,
          Metadata: { 'expected-size': String(expectedSize) }
        })
      )
      if (!response.UploadId) {
        throw new Error('S3 did not return an UploadId')
      }
      return { uploadId: response.UploadId, key, bucket: bucketName } satisfies S3MultipartUpload
    },
    catch: (error) =>
      new S3Error({
        message: `Failed to create multipart upload: ${getErrorMessage(error)}`,
        operation: 'createMultipartUpload',
        key
      })
  }).pipe(
    Effect.withSpan('aws.s3.createMultipartUpload', {
      attributes: {
        'storage.provider': store.provider,
        'aws.service': 's3',
        's3.bucket': bucketName,
        's3.key_prefix': getKeyPrefix(key),
        'content.type': contentType
      }
    })
  )

const getObjectMetadataEffect = (store: ObjectStoreClientType, key: string, bucketName: string) =>
  Effect.tryPromise({
    try: async () => {
      const s3 = store.client
      try {
        const response = await s3.send(new HeadObjectCommand({ Bucket: bucketName, Key: key }))
        return {
          size: response.ContentLength ?? 0,
          metadata: response.Metadata ?? {}
        } satisfies S3ObjectMetadata
      } catch (error) {
        if (
          error instanceof Error &&
          (error.name === 'NotFound' ||
            error.name === 'NoSuchKey' ||
            ('$metadata' in error &&
              typeof error.$metadata === 'object' &&
              error.$metadata !== null &&
              'httpStatusCode' in error.$metadata &&
              error.$metadata.httpStatusCode === 404))
        ) {
          return null
        }
        throw error
      }
    },
    catch: (error) =>
      new S3Error({
        message: `Failed to inspect object: ${getErrorMessage(error)}`,
        operation: 'headObject',
        key
      })
  }).pipe(
    Effect.withSpan('aws.s3.headObjectMetadata', {
      attributes: {
        'storage.provider': store.provider,
        'aws.service': 's3',
        's3.bucket': bucketName,
        's3.key_prefix': getKeyPrefix(key)
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
    try: async () => {
      const s3 = store.signingClient
      const command = new UploadPartCommand({
        Bucket: bucketName,
        Key: key,
        UploadId: uploadId,
        PartNumber: partNumber
      })
      return await getSignedUrl(s3, command, { expiresIn: expiresInSeconds })
    },
    catch: (error) =>
      new S3Error({
        message: `Failed to presign upload part: ${getErrorMessage(error)}`,
        operation: 'presignUploadPart',
        key
      })
  }).pipe(
    Effect.withSpan('aws.s3.presignUploadPart', {
      attributes: {
        'storage.provider': store.provider,
        'aws.service': 's3',
        's3.bucket': bucketName,
        's3.key_prefix': getKeyPrefix(key),
        's3.part_number': partNumber
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
      const s3 = store.client
      const sortedParts: CompletedPart[] = parts
        .toSorted((a, b) => a.partNumber - b.partNumber)
        .map((p) => ({ ETag: p.etag, PartNumber: p.partNumber }))

      await s3.send(
        new CompleteMultipartUploadCommand({
          Bucket: bucketName,
          Key: key,
          UploadId: uploadId,
          MultipartUpload: { Parts: sortedParts }
        })
      )
      return { key, bucket: bucketName }
    },
    catch: (error) =>
      new S3Error({
        message: `Failed to complete multipart upload: ${getErrorMessage(error)}`,
        operation: 'completeMultipartUpload',
        key
      })
  }).pipe(
    Effect.withSpan('aws.s3.completeMultipartUpload', {
      attributes: {
        'storage.provider': store.provider,
        'aws.service': 's3',
        's3.bucket': bucketName,
        's3.key_prefix': getKeyPrefix(key),
        's3.part_count': parts.length
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
    try: async () => {
      const s3 = store.client
      await s3.send(
        new AbortMultipartUploadCommand({
          Bucket: bucketName,
          Key: key,
          UploadId: uploadId
        })
      )
    },
    catch: (error) =>
      new S3Error({
        message: `Failed to abort multipart upload: ${getErrorMessage(error)}`,
        operation: 'abortMultipartUpload',
        key
      })
  }).pipe(
    Effect.withSpan('aws.s3.abortMultipartUpload', {
      attributes: {
        'storage.provider': store.provider,
        'aws.service': 's3',
        's3.bucket': bucketName,
        's3.key_prefix': getKeyPrefix(key)
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
    try: async () => {
      const s3 = store.client
      const collected: S3MultipartPart[] = []
      let partNumberMarker: string | undefined

      do {
        const response = await s3.send(
          new ListPartsCommand({
            Bucket: bucketName,
            Key: key,
            UploadId: uploadId,
            PartNumberMarker: partNumberMarker
          })
        )

        for (const part of response.Parts ?? []) {
          if (part.PartNumber && part.ETag) {
            collected.push({
              partNumber: part.PartNumber,
              etag: part.ETag,
              size: part.Size ?? 0
            })
          }
        }

        partNumberMarker =
          response.IsTruncated && response.NextPartNumberMarker
            ? String(response.NextPartNumberMarker)
            : undefined
      } while (partNumberMarker)

      return collected.toSorted((a, b) => a.partNumber - b.partNumber)
    },
    catch: (error) =>
      new S3Error({
        message: `Failed to list multipart parts: ${getErrorMessage(error)}`,
        operation: 'listMultipartParts',
        key
      })
  }).pipe(
    Effect.withSpan('aws.s3.listParts', {
      attributes: {
        'storage.provider': store.provider,
        'aws.service': 's3',
        's3.bucket': bucketName,
        's3.key_prefix': getKeyPrefix(key)
      }
    })
  )

const listBucketsEffect = (
  store: ObjectStoreClientType,
  configuredBuckets: ReadonlyArray<string>
) => {
  if (store.provider === 'r2') return Effect.succeed([...configuredBuckets])

  return Effect.tryPromise({
    try: async () => {
      const s3 = store.client
      const response = await s3.send(new ListBucketsCommand({}))
      return (response.Buckets ?? [])
        .map((bucket) => bucket.Name)
        .filter((name): name is string => Boolean(name))
    },
    catch: (error) =>
      error instanceof Error
        ? new S3Error({
            message: `Failed to list buckets from S3: ${error.message}`,
            operation: 'list',
            key: 'buckets'
          })
        : new S3Error({
            message: `Failed to list buckets from S3: Unknown error: ${String(error)}`,
            operation: 'list',
            key: 'buckets'
          })
  }).pipe(
    Effect.withSpan('aws.s3.listBuckets', {
      attributes: {
        'storage.provider': store.provider,
        'aws.service': 's3'
      }
    })
  )
}

export const S3ServiceLayer = Layer.effect(
  S3Service,
  Effect.gen(function* () {
    const store = yield* ObjectStoreClient
    const config = yield* ConfigService
    const configuredBuckets = [config.buckets.userContent, config.buckets.mixes]

    return {
      uploadFile: (key, body, contentType, bucketName) =>
        uploadFileEffect(store, key, body, contentType, bucketName),
      presignPutObject: (key, contentType, bucketName, expiresInSeconds) =>
        presignPutObjectEffect(store, key, contentType, bucketName, expiresInSeconds),
      deleteFile: (key, bucketName) => deleteFileEffect(store, key, bucketName),
      checkExists: (key, bucketName) => checkExistsEffect(store, key, bucketName),
      listObjects: (prefix, bucketName) => listObjectsEffect(store, prefix, bucketName),
      listBuckets: () => listBucketsEffect(store, configuredBuckets),
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
