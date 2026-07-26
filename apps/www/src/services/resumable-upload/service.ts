import * as Effect from 'effect/Effect'
import * as Schedule from 'effect/Schedule'
import { apiUrl } from '@/lib/http-url'
import {
  type PersistedResumableUpload,
  type ResumablePart,
  type ResumableUploadPhase,
  type ResumableUploadResult,
  computeFileFingerprint,
  createPersistedUpload,
  missingPartNumbers,
  parseAbortResponse,
  parseCompleteResponse,
  parseInitResponse,
  parsePresignPartResponse,
  parseStatusResponse,
  splitFileIntoChunks,
  withUpdatedPart
} from '@/lib/upload/resumable-upload'
import {
  type ResumableUploadError,
  FileTooLargeError,
  HttpError,
  InvalidResponseError,
  NetworkError,
  UploadAborted,
  UploadPaused,
  isRetryableError
} from './errors'
import { type ResumableUploadStorage, clearCheckpoint, writeCheckpoint } from './storage'

const MAX_PART_ATTEMPTS = 5
const PART_RETRY_BASE_MS = 500
const INIT_RETRY_TIMES = 3
const COMPLETE_RETRY_TIMES = 3
const ABORT_RETRY_TIMES = 2
const DEFAULT_MAX_BYTES = 200 * 1024 * 1024

export type { ResumableUploadPhase, ResumableUploadResult, PersistedResumableUpload, ResumablePart }

export interface UploadProgress {
  readonly phase: ResumableUploadPhase
  readonly bytesUploaded: number
  readonly totalBytes: number
  readonly currentPart: number
  readonly totalParts: number
}

export interface UploadOptions {
  readonly signal: AbortSignal
  readonly isPaused: () => boolean
  readonly onProgress: (progress: UploadProgress) => void
  readonly onCheckpoint: (checkpoint: PersistedResumableUpload) => void
  readonly checkpoint?: PersistedResumableUpload
}

export interface UploadInput {
  readonly file: File
  readonly fileType: 'audio' | 'image'
  readonly maxBytes?: number
}

const emitProgress = (options: UploadOptions, progress: UploadProgress) =>
  Effect.sync(() => options.onProgress(progress))

const persistCheckpoint = (options: UploadOptions, checkpoint: PersistedResumableUpload) =>
  writeCheckpoint(checkpoint).pipe(
    Effect.andThen(Effect.sync(() => options.onCheckpoint(checkpoint)))
  )

const decodeOrFail = <A>(decode: (raw: unknown) => A, raw: unknown, label: string): A => {
  try {
    return decode(raw)
  } catch (error) {
    throw new InvalidResponseError({
      message: `${label}: ${error instanceof Error ? error.message : String(error)}`
    })
  }
}

const httpRequest = (
  url: string,
  init: Omit<RequestInit, 'signal'> & { signal: AbortSignal }
): Effect.Effect<Response, NetworkError | HttpError | UploadAborted, never> =>
  Effect.tryPromise({
    try: () =>
      fetch(url, {
        ...init,
        credentials: init.credentials ?? 'include'
      }),
    catch: (cause) => {
      if (init.signal.aborted) return new UploadAborted()
      if (cause instanceof Error && cause.name === 'AbortError') return new UploadAborted()
      return new NetworkError({
        message: cause instanceof Error ? cause.message : String(cause),
        cause
      })
    }
  }).pipe(
    Effect.flatMap((response) =>
      response.ok
        ? Effect.succeed(response)
        : Effect.fail(
            new HttpError({
              status: response.status,
              message: `HTTP ${response.status} ${response.statusText}`.trim()
            })
          )
    )
  )

const retryableJsonRequest = <A>(
  url: string,
  init: Omit<RequestInit, 'signal'> & { signal: AbortSignal },
  decode: (raw: unknown) => A,
  label: string,
  times: number
): Effect.Effect<A, ResumableUploadError, never> =>
  httpRequest(url, init).pipe(
    Effect.flatMap((response) =>
      Effect.tryPromise({
        try: () => response.json(),
        catch: () => new InvalidResponseError({ message: `${label}: failed to parse JSON` })
      }).pipe(Effect.map((raw) => decodeOrFail(decode, raw, label)))
    ),
    Effect.retry({
      schedule: Schedule.exponential(`${PART_RETRY_BASE_MS} millis`),
      times,
      while: (error) => isRetryableError(error) && !init.signal.aborted
    })
  )

const initUpload = (
  input: UploadInput,
  signal: AbortSignal
): Effect.Effect<
  { uploadId: string; key: string; chunkSize: number },
  ResumableUploadError,
  never
> =>
  retryableJsonRequest(
    apiUrl('/upload/multipart/init'),
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fileName: input.file.name,
        contentType: input.file.type,
        fileSize: input.file.size,
        fileType: input.fileType
      }),
      signal
    },
    parseInitResponse,
    'init',
    INIT_RETRY_TIMES
  )

const fetchStatus = (
  persisted: PersistedResumableUpload,
  signal: AbortSignal
): Effect.Effect<{ parts: ResumablePart[] }, ResumableUploadError, never> => {
  const url = apiUrl(
    `/upload/multipart/status?key=${encodeURIComponent(persisted.key)}&uploadId=${encodeURIComponent(persisted.uploadId)}`
  )
  return retryableJsonRequest(
    url,
    { method: 'GET', signal },
    parseStatusResponse,
    'status',
    INIT_RETRY_TIMES
  )
}

const presignPart = (
  working: PersistedResumableUpload,
  partNumber: number,
  signal: AbortSignal
): Effect.Effect<{ url: string }, ResumableUploadError, never> =>
  retryableJsonRequest(
    apiUrl('/upload/multipart/presign-part'),
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: working.key, uploadId: working.uploadId, partNumber }),
      signal
    },
    parsePresignPartResponse,
    'presign-part',
    INIT_RETRY_TIMES
  )

// PUTs the raw part body straight to S3 using the presigned URL -- bypasses
// API Gateway/VPS entirely for the heavy bytes (see apps/vps/src/http/
// upload.handlers.ts's presignMultipartPart and PR #130's band-aid this
// replaces). No credentials/cookies on this request: the presigned URL's
// signature is the only auth, so this intentionally does not go through
// httpRequest's credentials: 'include' default.
const putPartToS3 = (
  url: string,
  blob: Blob,
  signal: AbortSignal
): Effect.Effect<string, NetworkError | HttpError | InvalidResponseError | UploadAborted, never> =>
  Effect.tryPromise({
    try: () => fetch(url, { method: 'PUT', body: blob, signal }),
    catch: (cause) => {
      if (signal.aborted) return new UploadAborted()
      if (cause instanceof Error && cause.name === 'AbortError') return new UploadAborted()
      return new NetworkError({
        message: cause instanceof Error ? cause.message : String(cause),
        cause
      })
    }
  }).pipe(
    Effect.flatMap((response) => {
      if (!response.ok) {
        return Effect.fail(
          new HttpError({
            status: response.status,
            message: `HTTP ${response.status} ${response.statusText}`.trim()
          })
        )
      }
      const etag = response.headers.get('ETag')
      if (!etag) {
        return Effect.fail(
          new InvalidResponseError({ message: 'part: S3 response missing ETag header' })
        )
      }
      return Effect.succeed(etag)
    })
  )

const uploadPart = (
  working: PersistedResumableUpload,
  part: { partNumber: number; blob: Blob },
  signal: AbortSignal
): Effect.Effect<ResumablePart, ResumableUploadError, never> =>
  Effect.gen(function* () {
    if (signal.aborted) return yield* new UploadAborted()

    const { url } = yield* presignPart(working, part.partNumber, signal)
    const etag = yield* putPartToS3(url, part.blob, signal)

    return { partNumber: part.partNumber, etag, size: part.blob.size }
  }).pipe(
    Effect.retry({
      schedule: Schedule.exponential(`${PART_RETRY_BASE_MS} millis`),
      times: MAX_PART_ATTEMPTS,
      while: (error) => isRetryableError(error) && !signal.aborted
    })
  )

const completeUpload = (
  working: PersistedResumableUpload,
  signal: AbortSignal
): Effect.Effect<ResumableUploadResult, ResumableUploadError, never> =>
  retryableJsonRequest(
    apiUrl('/upload/multipart/complete'),
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        key: working.key,
        uploadId: working.uploadId,
        parts: working.completedParts.map((p) => ({ partNumber: p.partNumber, etag: p.etag }))
      }),
      signal
    },
    parseCompleteResponse,
    'complete',
    COMPLETE_RETRY_TIMES
  )

const abortUpload = (
  persisted: PersistedResumableUpload,
  signal: AbortSignal
): Effect.Effect<void, ResumableUploadError, never> =>
  Effect.gen(function* () {
    if (signal.aborted) return
    const response = yield* httpRequest(apiUrl('/upload/multipart/abort'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: persisted.key, uploadId: persisted.uploadId }),
      signal
    }).pipe(
      Effect.retry({
        schedule: Schedule.exponential('1 second'),
        times: ABORT_RETRY_TIMES,
        while: (error) => isRetryableError(error) && !signal.aborted
      })
    )
    const raw = yield* Effect.tryPromise({
      try: () => response.json(),
      catch: () => new InvalidResponseError({ message: 'abort: failed to parse JSON' })
    })
    decodeOrFail(parseAbortResponse, raw, 'abort')
  }).pipe(Effect.asVoid)

const sumCompleted = (parts: ReadonlyArray<ResumablePart>): number =>
  parts.reduce((s, p) => s + p.size, 0)

export const uploadProgram = (
  input: UploadInput,
  options: UploadOptions
): Effect.Effect<ResumableUploadResult, ResumableUploadError, ResumableUploadStorage> =>
  Effect.gen(function* () {
    const max = input.maxBytes ?? DEFAULT_MAX_BYTES
    if (input.file.size > max) {
      return yield* new FileTooLargeError({ maxBytes: max, actualBytes: input.file.size })
    }

    const fingerprint = computeFileFingerprint(input.file)

    yield* emitProgress(options, {
      phase: 'preparing',
      bytesUploaded: 0,
      totalBytes: input.file.size,
      currentPart: 0,
      totalParts: 0
    })

    let persisted: PersistedResumableUpload
    if (options.checkpoint) {
      const status = yield* fetchStatus(options.checkpoint, options.signal)
      persisted = {
        ...options.checkpoint,
        completedParts: status.parts,
        updatedAt: Date.now()
      }
    } else {
      const init = yield* initUpload(input, options.signal)
      persisted = createPersistedUpload({
        file: input.file,
        fileFingerprint: fingerprint,
        init
      })
    }

    yield* persistCheckpoint(options, persisted)

    const chunks = splitFileIntoChunks(input.file, persisted.chunkSize)
    const todo = missingPartNumbers(persisted.totalParts, persisted.completedParts)
      .map((partNumber) => chunks[partNumber - 1])
      .filter((chunk): chunk is (typeof chunks)[number] => Boolean(chunk))

    yield* emitProgress(options, {
      phase: 'uploading',
      bytesUploaded: sumCompleted(persisted.completedParts),
      totalBytes: persisted.totalBytes,
      currentPart: persisted.completedParts.length,
      totalParts: persisted.totalParts
    })

    let working: PersistedResumableUpload = persisted
    for (const chunk of todo) {
      if (options.signal.aborted) return yield* new UploadAborted()
      if (options.isPaused()) {
        yield* persistCheckpoint(options, working)
        yield* emitProgress(options, {
          phase: 'paused',
          bytesUploaded: sumCompleted(working.completedParts),
          totalBytes: working.totalBytes,
          currentPart: working.completedParts.length,
          totalParts: working.totalParts
        })
        return yield* new UploadPaused({ checkpoint: working })
      }

      const result = yield* uploadPart(
        working,
        { partNumber: chunk.partNumber, blob: chunk.blob },
        options.signal
      )

      working = withUpdatedPart(working, result)
      yield* persistCheckpoint(options, working)

      yield* emitProgress(options, {
        phase: 'uploading',
        bytesUploaded: sumCompleted(working.completedParts),
        totalBytes: working.totalBytes,
        currentPart: working.completedParts.length,
        totalParts: working.totalParts
      })
    }

    if (options.isPaused()) {
      yield* persistCheckpoint(options, working)
      yield* emitProgress(options, {
        phase: 'paused',
        bytesUploaded: sumCompleted(working.completedParts),
        totalBytes: working.totalBytes,
        currentPart: working.completedParts.length,
        totalParts: working.totalParts
      })
      return yield* new UploadPaused({ checkpoint: working })
    }
    if (options.signal.aborted) return yield* new UploadAborted()

    yield* emitProgress(options, {
      phase: 'finalizing',
      bytesUploaded: working.totalBytes,
      totalBytes: working.totalBytes,
      currentPart: working.totalParts,
      totalParts: working.totalParts
    })

    const result = yield* completeUpload(working, options.signal)

    yield* clearCheckpoint(fingerprint)
    yield* emitProgress(options, {
      phase: 'completed',
      bytesUploaded: working.totalBytes,
      totalBytes: working.totalBytes,
      currentPart: working.totalParts,
      totalParts: working.totalParts
    })

    return result
  })

export const cancelProgram = (
  persisted: PersistedResumableUpload,
  signal: AbortSignal
): Effect.Effect<void, never, ResumableUploadStorage> =>
  abortUpload(persisted, signal).pipe(
    Effect.ignore,
    Effect.ensuring(clearCheckpoint(persisted.fileFingerprint))
  )
