import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CopyObjectCommand,
  CreateMultipartUploadCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  type CompletedPart,
  ListBucketsCommand,
  ListObjectsV2Command,
  ListPartsCommand,
  PutObjectCommand,
  S3Client,
  UploadPartCommand
} from '@aws-sdk/client-s3'
import { Context, Effect, Layer } from 'effect'
import { getErrorMessage, S3Error } from '@/errors'

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

  readonly deleteFile: (key: string, bucketName: string) => Effect.Effect<void, S3Error>

  readonly checkExists: (key: string, bucketName: string) => Effect.Effect<boolean, never>

  readonly listObjects: (
    prefix: string,
    bucketName: string
  ) => Effect.Effect<Array<{ key: string; lastModified: Date; size: number }>, S3Error>

  readonly copyFile: (
    key: string,
    sourceBucket: string,
    destinationBucket: string
  ) => Effect.Effect<void, S3Error>

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

  readonly uploadMultipartPart: (
    key: string,
    uploadId: string,
    partNumber: number,
    body: Buffer | Uint8Array | Blob,
    bucketName: string
  ) => Effect.Effect<{ partNumber: number; etag: string; size: number }, S3Error>

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
  key: string,
  body: Buffer | Uint8Array | Blob | string,
  contentType: string,
  bucketName: string
) =>
  Effect.tryPromise({
    try: async () => {
      const s3 = new S3Client({})
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
      Effect.annotateCurrentSpan('aws.service', 's3').pipe(
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

const deleteFileEffect = (key: string, bucketName: string) =>
  Effect.tryPromise({
    try: async () => {
      const s3 = new S3Client({})
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
        'aws.service': 's3',
        's3.bucket': bucketName,
        's3.key_prefix': getKeyPrefix(key)
      }
    })
  )

const checkExistsEffect = (key: string, bucketName: string) =>
  Effect.tryPromise({
    try: async () => {
      const s3 = new S3Client({})
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
        'aws.service': 's3',
        's3.bucket': bucketName,
        's3.key_prefix': getKeyPrefix(key)
      }
    })
  )

const listObjectsEffect = (prefix: string, bucketName: string) =>
  Effect.tryPromise({
    try: async () => {
      const s3 = new S3Client({})
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
        'aws.service': 's3',
        's3.bucket': bucketName,
        's3.prefix': prefix
      }
    })
  )

const copyFileEffect = (key: string, sourceBucket: string, destinationBucket: string) =>
  Effect.tryPromise({
    try: async () => {
      const s3 = new S3Client({})
      await s3.send(
        new CopyObjectCommand({
          Bucket: destinationBucket,
          CopySource: `${sourceBucket}/${key}`,
          Key: key
        })
      )
    },
    catch: (error) =>
      error instanceof Error
        ? new S3Error({
            message: `Failed to copy file in S3: ${error.message}`,
            operation: 'copy',
            key
          })
        : new S3Error({
            message: `Failed to copy file in S3: Unknown error: ${String(error)}`,
            operation: 'copy',
            key
          })
  }).pipe(
    Effect.withSpan('aws.s3.copyObject', {
      attributes: {
        'aws.service': 's3',
        's3.source_bucket': sourceBucket,
        's3.destination_bucket': destinationBucket,
        's3.key_prefix': getKeyPrefix(key)
      }
    })
  )

const createMultipartUploadEffect = (
  key: string,
  contentType: string,
  expectedSize: number,
  bucketName: string
) =>
  Effect.tryPromise({
    try: async () => {
      const s3 = new S3Client({})
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
        'aws.service': 's3',
        's3.bucket': bucketName,
        's3.key_prefix': getKeyPrefix(key),
        'content.type': contentType
      }
    })
  )

const getObjectMetadataEffect = (key: string, bucketName: string) =>
  Effect.tryPromise({
    try: async () => {
      const s3 = new S3Client({})
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
        'aws.service': 's3',
        's3.bucket': bucketName,
        's3.key_prefix': getKeyPrefix(key)
      }
    })
  )

const uploadMultipartPartEffect = (
  key: string,
  uploadId: string,
  partNumber: number,
  body: Buffer | Uint8Array | Blob,
  bucketName: string
) =>
  Effect.tryPromise({
    try: async () => {
      const s3 = new S3Client({})
      const response = await s3.send(
        new UploadPartCommand({
          Bucket: bucketName,
          Key: key,
          UploadId: uploadId,
          PartNumber: partNumber,
          Body: body
        })
      )
      if (!response.ETag) {
        throw new Error('S3 did not return an ETag for the uploaded part')
      }
      const size = body instanceof Blob ? body.size : body.byteLength
      return { partNumber, etag: response.ETag, size }
    },
    catch: (error) =>
      new S3Error({
        message: `Failed to upload multipart part: ${getErrorMessage(error)}`,
        operation: 'uploadMultipartPart',
        key
      })
  }).pipe(
    Effect.withSpan('aws.s3.uploadPart', {
      attributes: {
        'aws.service': 's3',
        's3.bucket': bucketName,
        's3.key_prefix': getKeyPrefix(key),
        's3.part_number': partNumber,
        'payload.size_bytes': body instanceof Blob ? body.size : body.byteLength
      }
    })
  )

const completeMultipartUploadEffect = (
  key: string,
  uploadId: string,
  parts: ReadonlyArray<{ partNumber: number; etag: string }>,
  bucketName: string
) =>
  Effect.tryPromise({
    try: async () => {
      const s3 = new S3Client({})
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
        'aws.service': 's3',
        's3.bucket': bucketName,
        's3.key_prefix': getKeyPrefix(key),
        's3.part_count': parts.length
      }
    })
  )

const abortMultipartUploadEffect = (key: string, uploadId: string, bucketName: string) =>
  Effect.tryPromise({
    try: async () => {
      const s3 = new S3Client({})
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
        'aws.service': 's3',
        's3.bucket': bucketName,
        's3.key_prefix': getKeyPrefix(key)
      }
    })
  )

const listMultipartPartsEffect = (key: string, uploadId: string, bucketName: string) =>
  Effect.tryPromise({
    try: async () => {
      const s3 = new S3Client({})
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
        'aws.service': 's3',
        's3.bucket': bucketName,
        's3.key_prefix': getKeyPrefix(key)
      }
    })
  )

const listBucketsEffect = () =>
  Effect.tryPromise({
    try: async () => {
      const s3 = new S3Client({})
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
        'aws.service': 's3'
      }
    })
  )

// Implementation - simple layer (effects are pure functions)
export const S3ServiceLayer = Layer.succeed(S3Service, {
  uploadFile: uploadFileEffect,
  deleteFile: deleteFileEffect,
  checkExists: checkExistsEffect,
  listObjects: listObjectsEffect,
  copyFile: copyFileEffect,
  listBuckets: listBucketsEffect,
  createMultipartUpload: createMultipartUploadEffect,
  getObjectMetadata: getObjectMetadataEffect,
  uploadMultipartPart: uploadMultipartPartEffect,
  completeMultipartUpload: completeMultipartUploadEffect,
  abortMultipartUpload: abortMultipartUploadEffect,
  listMultipartParts: listMultipartPartsEffect
})
