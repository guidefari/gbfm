import {
  CopyObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  ListBucketsCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client
} from '@aws-sdk/client-s3'
import { Context, Effect, Layer } from 'effect'
import { S3Error } from '@/errors'

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
export const S3ServiceLive = Layer.succeed(S3Service, {
  uploadFile: uploadFileEffect,
  deleteFile: deleteFileEffect,
  checkExists: checkExistsEffect,
  listObjects: listObjectsEffect,
  copyFile: copyFileEffect,
  listBuckets: listBucketsEffect
})
