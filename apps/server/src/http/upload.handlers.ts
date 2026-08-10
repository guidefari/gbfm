import { Api } from '@gbfm/api/api'
import { FileTooLargeError } from '@gbfm/api/errors'
import { AuthSession } from '@gbfm/api/middleware/auth'
import { Effect } from 'effect'
import { HttpApiBuilder, HttpApiError } from 'effect/unstable/httpapi'
import { dieOnS3Error as makeDieOnS3Error } from '@/http/handler-utils'
import { ConfigService } from '@/services/config.service'
import { S3Service } from '@/services/s3.service'
import { UploadAssetService } from '@/services/upload-asset.service'

const dieOnS3Error = makeDieOnS3Error('upload')

const CHUNK_SIZE = 8 * 1024 * 1024
const MAX_AUDIO_SIZE = 200 * 1024 * 1024
const MAX_IMAGE_SIZE = 10 * 1024 * 1024

// Long enough to cover an 8 MiB part PUT over a genuinely slow upload
// connection with room for a retry or two before the URL goes stale, short
// enough to bound how long a leaked URL stays usable.
const PRESIGNED_PART_URL_EXPIRY_SECONDS = 15 * 60

// Matches PR #220's PRESIGNED_PART_URL_EXPIRY_SECONDS reasoning: long enough
// to cover a slow-connection PUT with retry headroom, short enough to bound
// how long a leaked URL stays usable. Images are a single PUT of at most
// MAX_IMAGE_SIZE (10 MiB), so the same 5-minute window is generous rather
// than tight here.
const PRESIGNED_IMAGE_URL_EXPIRY_SECONDS = 5 * 60

// How long a `pending` upload_assets row is allowed to sit unconfirmed before
// a future cleanup job (out of scope here, see docs/migrations -- this table
// only needs to carry enough for that job to find candidates) is entitled to
// reclaim the S3 object. Deliberately generous relative to the presigned URL
// expiry above: the URL expiring doesn't mean the user gave up, they may
// retry and get a fresh presign against the same pending row's key.
const PENDING_ASSET_EXPIRY_SECONDS = 30 * 24 * 60 * 60

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

const buildImageObjectKey = (userId: string, fileName: string): string => {
  const sanitizedName = sanitizeKeySegment(fileName)
  return `${sanitizeKeySegment(userId)}/image/${crypto.randomUUID()}/${sanitizedName}`
}

// Best-effort: a failure recording lifecycle state must never fail the
// upload/save request it's attached to (see upload-asset.service.ts's
// top-of-file comment) -- logged and swallowed rather than dying or
// propagating, since this table is a future cleanup job's bookkeeping, not
// part of the upload's own correctness.
const recordAssetLifecycle = <A>(effect: Effect.Effect<A, { readonly _tag: 'DatabaseError' }>) =>
  effect.pipe(
    Effect.asVoid,
    Effect.catchTag('DatabaseError', (cause) =>
      Effect.logError('[upload] failed to record upload_assets lifecycle state', cause)
    )
  )

export const assertKeyOwnership = (userId: string, key: string) =>
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

export const UploadHandlersLive = HttpApiBuilder.group(Api, 'upload', (handlers) =>
  handlers
    // Images are a single PUT (no chunking, no multipart session) -- the
    // browser asks for a presigned URL scoped to a key it doesn't control,
    // then PUTs bytes straight to S3. Unlike the old uploadFile proxy, this
    // requires a session: the presigned URL is generated server-side under
    // the caller's own userId-prefixed key, so an unauthenticated caller has
    // no key to even ask for.
    //
    // No separate "confirm" endpoint: an image PUT is one request with no
    // resumability to reconcile (contrast the multipart-audio path, where
    // completeMultipartUpload has real work to do -- verifying parts/etags
    // against S3's own bookkeeping). The upload_assets row this creates
    // starts at `pending` and is never flipped to `uploaded` by this handler;
    // it moves straight to `attached` when the caller's own follow-up write
    // (saving an audio/post/etc. record with this key as its url or
    // thumbnailUrl) succeeds -- see audio.service.ts's createEffect. A
    // `pending` row that never gets attached (PUT failed, or the content save
    // never happened) is exactly what the future cleanup job is for; this
    // task doesn't distinguish "PUT never happened" from "PUT happened but
    // nothing referenced it yet" since neither S3 event notifications nor a
    // client-reported confirm step are in scope here (see PR body).
    .handle('presignImage', ({ payload }) =>
      Effect.gen(function* () {
        const { user } = yield* AuthSession

        if (payload.fileSize > MAX_IMAGE_SIZE) {
          return yield* new FileTooLargeError({
            message: `File too large. Maximum size is ${MAX_IMAGE_SIZE / (1024 * 1024)}MB`,
            maxBytes: MAX_IMAGE_SIZE
          })
        }

        const key = buildImageObjectKey(user.id, payload.fileName)

        const config = yield* ConfigService
        const s3Service = yield* S3Service
        const uploadUrl = yield* dieOnS3Error(
          s3Service.presignPutObject(
            key,
            payload.contentType,
            config.buckets.userContent,
            PRESIGNED_IMAGE_URL_EXPIRY_SECONDS
          )
        )

        const uploadAssetService = yield* UploadAssetService
        yield* recordAssetLifecycle(
          uploadAssetService.createPending({
            userId: user.id,
            key,
            bucket: config.buckets.userContent,
            assetType: 'image',
            expectedSize: payload.fileSize,
            expiresInSeconds: PENDING_ASSET_EXPIRY_SECONDS
          })
        )

        return {
          uploadUrl,
          publicUrl: `${config.urls.bucketRouter}/user-content/${key}`,
          key,
          expiresInSeconds: PRESIGNED_IMAGE_URL_EXPIRY_SECONDS
        }
      }).pipe(
        Effect.withSpan('api.upload.image.presign', {
          attributes: { fileSize: payload.fileSize }
        })
      )
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

        const uploadAssetService = yield* UploadAssetService
        yield* recordAssetLifecycle(
          uploadAssetService.createPending({
            userId: user.id,
            key: upload.key,
            bucket: config.buckets.userContent,
            assetType: 'audio',
            uploadId: upload.uploadId,
            expectedSize: payload.fileSize,
            expiresInSeconds: PENDING_ASSET_EXPIRY_SECONDS
          })
        )

        return { uploadId: upload.uploadId, key: upload.key, chunkSize: CHUNK_SIZE }
      }).pipe(
        Effect.withSpan('api.upload.multipart.init', {
          attributes: { fileType: payload.fileType, fileSize: payload.fileSize }
        })
      )
    )
    .handle('presignMultipartPart', ({ payload }) =>
      Effect.gen(function* () {
        const { user } = yield* AuthSession
        const { key, uploadId, partNumber } = payload

        yield* assertKeyOwnership(user.id, key)
        const expectedSize = yield* requireExpectedSize(user.id, key)
        // Only partNumber is checked here -- actual byte size can't be
        // validated at presign time since the client hasn't PUT the bytes
        // to S3 yet (this just mints the URL). A client can still push an
        // oversized part straight to S3 after presigning; that garbage
        // isn't reachable (the object never becomes readable pre-completion)
        // and completeMultipartUpload below re-validates every part's real
        // S3-reported size via listMultipartParts + validateMultipartParts,
        // rejecting the whole upload on any mismatch. Worst case is
        // billable-but-unreadable storage until the bucket's abort-
        // incomplete-multipart-upload lifecycle rule reaps it.
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
        const uploadAssetService = yield* UploadAssetService

        const existing = yield* dieOnS3Error(
          s3Service.getObjectMetadata(key, config.buckets.userContent)
        )
        if (existing) {
          if (!matchesCompletedObject(expectedSize, existing)) {
            return yield* new HttpApiError.BadRequest()
          }
          yield* recordAssetLifecycle(uploadAssetService.markUploaded(key))
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
        yield* recordAssetLifecycle(uploadAssetService.markUploaded(key))

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
