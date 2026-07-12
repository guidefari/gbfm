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
// decoder, not just eyeballing the schema. This is the same mismatch already
// live in `user.ts`'s `UpdateProfileMultipartInput.avatar` (also
// Schema.File), which this PR does not touch -- flagged separately, not
// silently carried forward as "the established pattern" without re-checking.
//
// The simple `/upload/file` endpoint has never required a session -- the old
// Hono route (apps/vps/src/routes/upload/upload.routes.ts) had no
// betterAuthMiddleware, and none of its real apps/www callers send
// credentials: 'include'. Preserved as-is; changing that is a product/
// security decision outside this migration's scope, not something to
// silently fix or silently carry forward without flagging in review.
export const UploadFileInput = Schema.Struct({
  audioFile: Schema.optional(Multipart.SingleFileSchema),
  imageFile: Schema.optional(Multipart.SingleFileSchema),
  fileType: Schema.Literals(['audio', 'image'])
}).pipe(HttpApiSchema.asMultipart())

export const UploadFileResponse = Schema.Struct({
  url: Schema.String,
  key: Schema.String
})

const PartNumber = Schema.Number.pipe(
  Schema.check(Schema.isBetween({ minimum: 1, maximum: 10000 }))
)

export const InitMultipartUploadInput = Schema.Struct({
  fileName: Schema.NonEmptyString.pipe(Schema.check(Schema.isMaxLength(255))),
  // Matches the old regex(/^audio\//) constraint -- multipart upload is
  // audio-only today (fileType is a literal 'audio' below).
  contentType: Schema.NonEmptyString.pipe(
    Schema.check(Schema.isMaxLength(127), Schema.isPattern(/^audio\//))
  ),
  fileSize: Schema.Number.pipe(Schema.check(Schema.isGreaterThan(0))),
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
  partNumber: PartNumber,
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
    HttpApiEndpoint.post('uploadFile', '/api/upload/file', {
      payload: UploadFileInput,
      success: UploadFileResponse,
      error: HttpApiError.BadRequest
    })
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
