import { Schema } from 'effect'
import { Multipart } from 'effect/unstable/http'
import { HttpApiEndpoint, HttpApiError, HttpApiGroup, HttpApiSchema } from 'effect/unstable/httpapi'
import { FileTooLargeError } from './errors'
import { AuthMiddleware } from './middleware/auth'

// Multipart file fields decode to Multipart.PersistedFile (buffered mode:
// { key, name, contentType, path } -- the part is written to a temp file on
// disk, not held in memory), never a real global `File`. Schema.File
// (instanceOf(globalThis.File)) looks correct at a glance and typechecks,
// but rejects every real multipart request at decode time -- confirmed by
// reproducing an actual multipart POST against HttpApiBuilder.group's real
// decoder, not just eyeballing the schema.

export const PartNumber = Schema.Number.pipe(
  Schema.check(Schema.isInt(), Schema.isBetween({ minimum: 1, maximum: 10000 }))
)

// multipart/form-data fields always decode to strings (confirmed against
// Multipart.toPersisted's real source -- part.value is never coerced), so
// the one partNumber field carried inside a multipart body (below) needs
// NumberFromString like every other multipart/query numeric field in this
// package (audio.ts, label.ts, post.ts, ...); PartNumber above stays plain
// Schema.Number for the JSON-body/response use sites where the value really
// is a number on the wire. Exported so upload.test.ts can pin this without
// needing a real Multipart.PersistedFile to satisfy the rest of the struct.
export const PartNumberFromString = Schema.NumberFromString.pipe(
  Schema.check(Schema.isInt(), Schema.isBetween({ minimum: 1, maximum: 10000 }))
)

// Images are a single PUT (no chunking), so this is intentionally simpler
// than the multipart flow above: one endpoint returns one presigned PUT URL
// scoped to a generated key, the browser PUTs directly to S3, and the
// caller's own follow-up write (e.g. saving an audio/post record with this
// key as its thumbnailUrl) is what proves the upload happened -- see
// apps/vps/src/http/upload.handlers.ts's presignImage handler comment for
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

// Raw binary chunk + control fields as multipart/form-data, matching the old
// Hono route's shape (apps/www's resumable-upload service sends a FormData
// body with key/uploadId/partNumber/chunk, unchanged by this port).
export const UploadMultipartPartInput = Schema.Struct({
  key: Schema.NonEmptyString,
  uploadId: Schema.NonEmptyString,
  partNumber: PartNumberFromString,
  chunk: Multipart.SingleFileSchema
}).pipe(HttpApiSchema.asMultipart())

export const UploadMultipartPartResponse = Schema.Struct({
  partNumber: PartNumber,
  etag: Schema.NonEmptyString,
  size: Schema.Number.pipe(Schema.check(Schema.isGreaterThanOrEqualTo(0)))
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
    HttpApiEndpoint.post('uploadMultipartPart', '/api/upload/multipart/part', {
      payload: UploadMultipartPartInput,
      success: UploadMultipartPartResponse,
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
