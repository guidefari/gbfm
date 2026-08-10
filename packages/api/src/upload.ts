import { Schema } from 'effect'
import { HttpApiEndpoint, HttpApiError, HttpApiGroup } from 'effect/unstable/httpapi'
import { FileTooLargeError } from './errors'
import { AuthMiddleware } from './middleware/auth'

export const PartNumber = Schema.Number.pipe(
  Schema.check(Schema.isInt(), Schema.isBetween({ minimum: 1, maximum: 10000 }))
)

// Images are a single PUT (no chunking), so this is intentionally simpler
// than the multipart flow above: one endpoint returns one presigned PUT URL
// scoped to a generated key, the browser PUTs directly to S3, and the
// caller's own follow-up write (e.g. saving an audio/post record with this
// key as its thumbnailUrl) is what proves the upload happened -- see
// apps/server/src/http/upload.handlers.ts's presignImage handler comment for
// why images don't get a separate "confirm" endpoint.
export const PresignImageUploadInput = Schema.Struct({
  fileName: Schema.NonEmptyString.pipe(Schema.check(Schema.isMaxLength(255))),
  contentType: Schema.NonEmptyString.pipe(
    Schema.check(Schema.isMaxLength(127), Schema.isPattern(/^image\//))
  ),
  fileSize: Schema.Number.pipe(Schema.check(Schema.isInt(), Schema.isGreaterThan(0)))
})

export const PresignImageUploadResponse = Schema.Struct({
  // Where the browser PUTs the raw file bytes -- a short-lived presigned S3
  // URL, not a URL to fetch/render the image from.
  uploadUrl: Schema.NonEmptyString,
  // The final CDN URL to store on the content record and render an <img
  // src> from, mirroring what uploadFile/completeMultipartUpload always
  // returned server-side. The frontend has never known the CDN/bucket base
  // URL itself (config.service.ts's bucketRouter is VPS-only config), so
  // this endpoint keeps computing it rather than pushing that knowledge
  // onto every call site.
  publicUrl: Schema.NonEmptyString,
  key: Schema.NonEmptyString,
  expiresInSeconds: Schema.Number
})

export const InitMultipartUploadInput = Schema.Struct({
  fileName: Schema.NonEmptyString.pipe(Schema.check(Schema.isMaxLength(255))),
  // Matches the old regex(/^audio\//) constraint -- multipart upload is
  // audio-only today (fileType is a literal 'audio' below).
  contentType: Schema.NonEmptyString.pipe(
    Schema.check(Schema.isMaxLength(127), Schema.isPattern(/^audio\//))
  ),
  fileSize: Schema.Number.pipe(Schema.check(Schema.isInt(), Schema.isGreaterThan(0))),
  fileType: Schema.Literal('audio')
})

export const InitMultipartUploadResponse = Schema.Struct({
  uploadId: Schema.String,
  key: Schema.String,
  chunkSize: Schema.Number
})

export const PresignMultipartPartInput = Schema.Struct({
  key: Schema.NonEmptyString,
  uploadId: Schema.NonEmptyString,
  partNumber: PartNumber
})

export const PresignMultipartPartResponse = Schema.Struct({
  url: Schema.NonEmptyString,
  partNumber: PartNumber,
  expiresInSeconds: Schema.Number
})

const CompletedPart = Schema.Struct({
  partNumber: PartNumber,
  etag: Schema.NonEmptyString
})

export const CompleteMultipartUploadInput = Schema.Struct({
  key: Schema.NonEmptyString,
  uploadId: Schema.NonEmptyString,
  parts: Schema.Array(CompletedPart).pipe(
    Schema.check(Schema.isMinLength(1), Schema.isMaxLength(10000))
  )
})

export const CompleteMultipartUploadResponse = Schema.Struct({
  url: Schema.String,
  key: Schema.String
})

export const AbortMultipartUploadInput = Schema.Struct({
  key: Schema.NonEmptyString,
  uploadId: Schema.NonEmptyString
})

export const AbortMultipartUploadResponse = Schema.Struct({
  ok: Schema.Literal(true)
})

const MultipartStatusPart = Schema.Struct({
  partNumber: PartNumber,
  etag: Schema.NonEmptyString,
  size: Schema.Number.pipe(Schema.check(Schema.isGreaterThanOrEqualTo(0)))
})

export const MultipartUploadStatusResponse = Schema.Struct({
  parts: Schema.Array(MultipartStatusPart)
})

export const UploadGroup = HttpApiGroup.make('upload')
  .add(
    HttpApiEndpoint.post('presignImage', '/api/upload/image/presign', {
      payload: PresignImageUploadInput,
      success: PresignImageUploadResponse,
      error: [HttpApiError.BadRequest, FileTooLargeError]
    }).middleware(AuthMiddleware)
  )
  .add(
    HttpApiEndpoint.post('initMultipartUpload', '/api/upload/multipart/init', {
      payload: InitMultipartUploadInput,
      success: InitMultipartUploadResponse,
      error: [HttpApiError.BadRequest, FileTooLargeError]
    }).middleware(AuthMiddleware)
  )
  .add(
    // Browser PUTs the raw part body directly to S3 with this URL --
    // bypasses API Gateway/VPS entirely for the heavy bytes, removing the
    // 10 MiB API Gateway ceiling that forced CHUNK_SIZE down to 8 MiB (see
    // PR #130). The old multipart/form-data proxy endpoint that used to
    // live at this spot (uploadMultipartPart, /api/upload/multipart/part)
    // has been removed -- this is now the only way part bytes reach S3.
    HttpApiEndpoint.post('presignMultipartPart', '/api/upload/multipart/presign-part', {
      payload: PresignMultipartPartInput,
      success: PresignMultipartPartResponse,
      error: HttpApiError.BadRequest
    }).middleware(AuthMiddleware)
  )
  .add(
    HttpApiEndpoint.post('completeMultipartUpload', '/api/upload/multipart/complete', {
      payload: CompleteMultipartUploadInput,
      success: CompleteMultipartUploadResponse,
      error: HttpApiError.BadRequest
    }).middleware(AuthMiddleware)
  )
  .add(
    HttpApiEndpoint.post('abortMultipartUpload', '/api/upload/multipart/abort', {
      payload: AbortMultipartUploadInput,
      success: AbortMultipartUploadResponse,
      error: HttpApiError.BadRequest
    }).middleware(AuthMiddleware)
  )
  .add(
    HttpApiEndpoint.get('multipartUploadStatus', '/api/upload/multipart/status', {
      query: {
        key: Schema.NonEmptyString,
        uploadId: Schema.NonEmptyString
      },
      success: MultipartUploadStatusResponse,
      error: HttpApiError.BadRequest
    }).middleware(AuthMiddleware)
  )
