import { Effect } from 'effect'
import type { S3Service } from '@/services/s3.service'

export const makeTestS3Service = (
  uploadFile: S3Service['uploadFile'] = (key) => Effect.succeed(key)
): S3Service => ({
  uploadFile,
  presignPutObject: (key) => Effect.succeed(key),
  deleteFile: () => Effect.void,
  checkExists: () => Effect.succeed(false),
  listObjects: () => Effect.succeed([]),
  listBuckets: () => Effect.succeed([]),
  createMultipartUpload: (key, _contentType, _expectedSize, bucketName) =>
    Effect.succeed({ uploadId: 'test-upload', key, bucket: bucketName }),
  getObjectMetadata: () => Effect.succeed(null),
  presignUploadPart: (key) => Effect.succeed(key),
  completeMultipartUpload: (key, _uploadId, _parts, bucketName) =>
    Effect.succeed({ key, bucket: bucketName }),
  abortMultipartUpload: () => Effect.void,
  listMultipartParts: () => Effect.succeed([])
})
