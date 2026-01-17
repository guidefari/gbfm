import {
  DeleteObjectCommand,
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

  readonly deleteFile: (
    key: string,
    bucketName: string
  ) => Effect.Effect<void, S3Error>
}

// Service tag for dependency injection
export const S3Service = Context.GenericTag<S3Service>('S3Service')

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
      new S3Error({
        message: `Failed to upload file to S3: ${(error as Error).message}`,
        operation: 'upload',
        key
      })
  })

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
      new S3Error({
        message: `Failed to delete file from S3: ${(error as Error).message}`,
        operation: 'delete',
        key
      })
  })

// Implementation - simple layer that provides access to the Effects
export const S3ServiceLive = Layer.succeed(S3Service, {
  uploadFile: uploadFileEffect,
  deleteFile: deleteFileEffect
})
