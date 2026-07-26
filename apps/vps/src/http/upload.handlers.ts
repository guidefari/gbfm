import { Api } from '@gbfm/api/api'
import { FileTooLargeError } from '@gbfm/api/errors'
import { AuthSession } from '@gbfm/api/middleware/auth'
import { Effect, FileSystem } from 'effect'
import type { Multipart } from 'effect/unstable/http'
import { HttpApiBuilder, HttpApiError } from 'effect/unstable/httpapi'
import {
  dieOnPlatformError as makeDieOnPlatformError,
  dieOnS3Error as makeDieOnS3Error
} from '@/http/handler-utils'
import { ConfigService } from '@/services/config.service'
import { S3Service } from '@/services/s3.service'

const dieOnS3Error = makeDieOnS3Error('upload')
const dieOnPlatformError = makeDieOnPlatformError('upload')

const CHUNK_SIZE = 8 * 1024 * 1024
const MAX_AUDIO_SIZE = 200 * 1024 * 1024
const MAX_IMAGE_SIZE = 10 * 1024 * 1024
// API Gateway HTTP API v2 caps request bodies at 10 MiB. A multipart/form-data
// request adds ~1 KiB of overhead on top of the file part, so the per-chunk
// ceiling must stay well under 10 MiB. 9 MiB leaves room for the form fields
// (key, uploadId, partNumber) and the boundary markers.
// Retained for the legacy uploadMultipartPart proxy endpoint only -- the new
// presignMultipartPart path PUTs straight to S3 and isn't bound by this.
const MAX_CHUNK_SIZE = 9 * 1024 * 1024

// Long enough to cover an 8 MiB PUT over a slow upload connection with retry
// headroom, short enough to bound how long a leaked URL stays usable.
const PRESIGNED_PART_URL_EXPIRY_SECONDS = 5 * 60

const sanitizeKeySegment = (value: string): string => value.replace(/[^a-zA-Z0-9.-]/g, '_')

const buildObjectKey = (
  userId: string,
  fileType: string,
  fileName: string,
  expectedSize: number
): string => {
  const sanitizedName = sanitizeKeySegment(fileName)
  return `${sanitizeKeySegment(userId)}/multipart/${crypto.randomUUID()}/${expectedSize}/${fileType}_${sanitizedName}`
}

const assertKeyOwnership = (userId: string, key: string) =>
  key.startsWith(`${sanitizeKeySegment(userId)}/`) ? Effect.void : new HttpApiError.BadRequest()

export const assertContiguousParts = (parts: ReadonlyArray<{ partNumber: number }>) => {
  const sorted = parts.toSorted((a, b) => a.partNumber - b.partNumber)
  for (const [index, part] of sorted.entries()) {
    if (part.partNumber !== index + 1) {
      return new HttpApiError.BadRequest()
    }
  }
  return null
}

export const expectedMultipartPartSize = (expectedSize: number, partNumber: number) => {
  const partCount = Math.ceil(expectedSize / CHUNK_SIZE)
  if (partNumber < 1 || partNumber > partCount) return null
  if (partNumber < partCount) return CHUNK_SIZE
  return expectedSize - CHUNK_SIZE * (partCount - 1)
}

export const validateMultipartParts = (
  expectedSize: number,
  parts: ReadonlyArray<{ partNumber: number; size: number }>
) => {
  if (parts.length !== Math.ceil(expectedSize / CHUNK_SIZE)) {
    return new HttpApiError.BadRequest()
  }
  const contiguityError = assertContiguousParts(parts)
  if (contiguityError) return contiguityError

  for (const part of parts) {
    if (part.size !== expectedMultipartPartSize(expectedSize, part.partNumber)) {
      return new HttpApiError.BadRequest()
    }
  }
  return null
}

export const matchesCompletedObject = (
  expectedSize: number,
  object: { readonly size: number; readonly metadata: Readonly<Record<string, string>> } | null
) => object?.size === expectedSize && object.metadata['expected-size'] === String(expectedSize)

const expectedSizeFromKey = (userId: string, key: string) => {
  const prefix = `${sanitizeKeySegment(userId)}/multipart/`
  if (!key.startsWith(prefix)) return null
  const segments = key.slice(prefix.length).split('/')
  if (segments.length !== 3 || !/^[0-9a-f-]{36}$/i.test(segments[0] ?? '')) return null
  const expectedSize = Number(segments[1])
  return Number.isSafeInteger(expectedSize) && expectedSize > 0 && expectedSize <= MAX_AUDIO_SIZE
    ? expectedSize
    : null
}

const requireExpectedSize = (userId: string, key: string) => {
  const expectedSize = expectedSizeFromKey(userId, key)
  return expectedSize === null
    ? Effect.fail(new HttpApiError.BadRequest())
    : Effect.succeed(expectedSize)
}

// Multipart file fields decode to Multipart.PersistedFile -- a disk-backed
// reference (key/name/contentType/path), not a real in-memory File. Reading
// it means going through FileSystem.FileSystem, not .arrayBuffer(); size
// comes from the read buffer's length since PersistedFile itself has no
// .size (see packages/api/src/upload.ts's comment on this same mismatch).
const readPersistedFile = (file: Multipart.PersistedFile) =>
  dieOnPlatformError(
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem
      const bytes = yield* fs.readFile(file.path)
      return {
        buffer: Buffer.from(bytes),
        size: bytes.length,
        contentType: file.contentType,
        name: file.name
      }
    })
  )

export const UploadHandlersLive = HttpApiBuilder.group(Api, 'upload', (handlers) =>
  handlers
    // The simple upload endpoint predates AuthMiddleware entirely -- the old
    // Hono route had no betterAuthMiddleware, and no apps/www caller sends
    // credentials: 'include' to it. Preserved as-is (not a regression to fix
    // here; a product/security decision, not a migration-scope one).
    .handle('uploadFile', ({ payload }) =>
      Effect.gen(function* () {
        const { fileType } = payload
        const persistedFile = fileType === 'audio' ? payload.audioFile : payload.imageFile

        if (!persistedFile) {
          return yield* new HttpApiError.BadRequest()
        }

        const file = yield* readPersistedFile(persistedFile)

        const maxSize = fileType === 'audio' ? MAX_AUDIO_SIZE : MAX_IMAGE_SIZE
        if (file.size > maxSize) {
          return yield* new HttpApiError.BadRequest()
        }
        if (!file.contentType.startsWith(`${fileType}/`)) {
          return yield* new HttpApiError.BadRequest()
        }

        const timestamp = Date.now()
        const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
        const fileName = `${fileType}_${timestamp}_${sanitizedName}`

        const config = yield* ConfigService
        const s3Service = yield* S3Service
        const key = yield* dieOnS3Error(
          s3Service.uploadFile(fileName, file.buffer, file.contentType, config.buckets.userContent)
        )

        return { url: `${config.urls.bucketRouter}/user-content/${key}`, key }
      }).pipe(Effect.withSpan('api.upload.file', { attributes: { fileType: payload.fileType } }))
    )
    .handle('initMultipartUpload', ({ payload }) =>
      Effect.gen(function* () {
        const { user } = yield* AuthSession

        if (payload.fileSize > MAX_AUDIO_SIZE) {
          return yield* new FileTooLargeError({
            message: `File too large. Maximum size is ${MAX_AUDIO_SIZE / (1024 * 1024)}MB`,
            maxBytes: MAX_AUDIO_SIZE
          })
        }

        const key = buildObjectKey(user.id, payload.fileType, payload.fileName, payload.fileSize)

        const config = yield* ConfigService
        const s3Service = yield* S3Service
        const upload = yield* dieOnS3Error(
          s3Service.createMultipartUpload(
            key,
            payload.contentType,
            payload.fileSize,
            config.buckets.userContent
          )
        )

        return { uploadId: upload.uploadId, key: upload.key, chunkSize: CHUNK_SIZE }
      }).pipe(
        Effect.withSpan('api.upload.multipart.init', {
          attributes: { fileType: payload.fileType, fileSize: payload.fileSize }
        })
      )
    )
    .handle('uploadMultipartPart', ({ payload }) =>
      Effect.gen(function* () {
        const { user } = yield* AuthSession
        const { key, uploadId, partNumber, chunk } = payload

        const file = yield* readPersistedFile(chunk)
        if (file.size === 0) {
          return yield* new HttpApiError.BadRequest()
        }
        if (file.size > MAX_CHUNK_SIZE) {
          return yield* new HttpApiError.BadRequest()
        }

        yield* assertKeyOwnership(user.id, key)
        const expectedSize = yield* requireExpectedSize(user.id, key)
        if (file.size !== expectedMultipartPartSize(expectedSize, partNumber)) {
          return yield* new HttpApiError.BadRequest()
        }

        const config = yield* ConfigService
        const s3Service = yield* S3Service
        const result = yield* dieOnS3Error(
          s3Service.uploadMultipartPart(
            key,
            uploadId,
            partNumber,
            file.buffer,
            config.buckets.userContent
          )
        )

        return { partNumber: result.partNumber, etag: result.etag, size: result.size }
      }).pipe(
        Effect.withSpan('api.upload.multipart.part', {
          attributes: { partNumber: payload.partNumber }
        })
      )
    )
    .handle('presignMultipartPart', ({ payload }) =>
      Effect.gen(function* () {
        const { user } = yield* AuthSession
        const { key, uploadId, partNumber } = payload

        yield* assertKeyOwnership(user.id, key)
        const expectedSize = yield* requireExpectedSize(user.id, key)
        if (expectedMultipartPartSize(expectedSize, partNumber) === null) {
          return yield* new HttpApiError.BadRequest()
        }

        const config = yield* ConfigService
        const s3Service = yield* S3Service
        const url = yield* dieOnS3Error(
          s3Service.presignUploadPart(
            key,
            uploadId,
            partNumber,
            config.buckets.userContent,
            PRESIGNED_PART_URL_EXPIRY_SECONDS
          )
        )

        return {
          url,
          partNumber,
          expiresInSeconds: PRESIGNED_PART_URL_EXPIRY_SECONDS
        }
      }).pipe(
        Effect.withSpan('api.upload.multipart.presignPart', {
          attributes: { partNumber: payload.partNumber }
        })
      )
    )
    .handle('completeMultipartUpload', ({ payload }) =>
      Effect.gen(function* () {
        const { user } = yield* AuthSession
        const { key, uploadId, parts } = payload

        yield* assertKeyOwnership(user.id, key)
        const expectedSize = yield* requireExpectedSize(user.id, key)

        const config = yield* ConfigService
        const s3Service = yield* S3Service
        const existing = yield* dieOnS3Error(
          s3Service.getObjectMetadata(key, config.buckets.userContent)
        )
        if (existing) {
          if (!matchesCompletedObject(expectedSize, existing)) {
            return yield* new HttpApiError.BadRequest()
          }
          return { url: `${config.urls.bucketRouter}/user-content/${key}`, key }
        }

        const uploadedParts = yield* dieOnS3Error(
          s3Service.listMultipartParts(key, uploadId, config.buckets.userContent)
        )
        const partsError = validateMultipartParts(expectedSize, uploadedParts)
        if (partsError) return yield* partsError

        const submittedByPartNumber = new Map(parts.map((part) => [part.partNumber, part.etag]))
        if (
          parts.length !== uploadedParts.length ||
          submittedByPartNumber.size !== uploadedParts.length ||
          uploadedParts.some((part) => submittedByPartNumber.get(part.partNumber) !== part.etag)
        ) {
          return yield* new HttpApiError.BadRequest()
        }

        yield* dieOnS3Error(
          s3Service
            .completeMultipartUpload(key, uploadId, parts, config.buckets.userContent)
            .pipe(
              Effect.catchTag('S3Error', (completionError) =>
                s3Service
                  .getObjectMetadata(key, config.buckets.userContent)
                  .pipe(
                    Effect.flatMap((object) =>
                      matchesCompletedObject(expectedSize, object)
                        ? Effect.void
                        : Effect.fail(completionError)
                    )
                  )
              )
            )
        )

        return { url: `${config.urls.bucketRouter}/user-content/${key}`, key }
      }).pipe(
        Effect.withSpan('api.upload.multipart.complete', {
          attributes: { key: payload.key, partCount: payload.parts.length }
        })
      )
    )
    .handle('abortMultipartUpload', ({ payload }) =>
      Effect.gen(function* () {
        const { user } = yield* AuthSession
        const { key, uploadId } = payload

        yield* assertKeyOwnership(user.id, key)
        yield* requireExpectedSize(user.id, key)

        const config = yield* ConfigService
        const s3Service = yield* S3Service
        yield* dieOnS3Error(
          s3Service.abortMultipartUpload(key, uploadId, config.buckets.userContent)
        )

        return { ok: true as const }
      }).pipe(Effect.withSpan('api.upload.multipart.abort', { attributes: { key: payload.key } }))
    )
    .handle('multipartUploadStatus', ({ query }) =>
      Effect.gen(function* () {
        const { user } = yield* AuthSession
        const { key, uploadId } = query

        yield* assertKeyOwnership(user.id, key)
        yield* requireExpectedSize(user.id, key)

        const config = yield* ConfigService
        const s3Service = yield* S3Service
        const parts = yield* dieOnS3Error(
          s3Service.listMultipartParts(key, uploadId, config.buckets.userContent)
        )

        return { parts }
      }).pipe(Effect.withSpan('api.upload.multipart.status', { attributes: { key: query.key } }))
    )
)
