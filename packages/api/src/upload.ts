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

export const PartNumber = Schema.Number.pipe(
  Schema.check(Schema.isInt(), Schema.isBetween({ minimum: 1, maximum: 10000 }))
)

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
