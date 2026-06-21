import { Data } from 'effect'
import type { PersistedResumableUpload } from '@/lib/upload/resumable-upload'

export class NetworkError extends Data.TaggedError('NetworkError')<{
  readonly message: string
  readonly cause?: unknown
}> {}

export class HttpError extends Data.TaggedError('HttpError')<{
  readonly status: number
  readonly message: string
  readonly partNumber?: number
}> {}

export class InvalidResponseError extends Data.TaggedError('InvalidResponseError')<{
  readonly message: string
}> {}

export class UploadAborted extends Data.TaggedError('UploadAborted')<{}> {}

export class UploadPaused extends Data.TaggedError('UploadPaused')<{
  readonly checkpoint: PersistedResumableUpload
}> {}

export class AlreadyInProgressError extends Data.TaggedError('AlreadyInProgressError')<{
  readonly message: string
}> {}

export class FileTooLargeError extends Data.TaggedError('FileTooLargeError')<{
  readonly maxBytes: number
  readonly actualBytes: number
}> {}

export class StorageQuotaError extends Data.TaggedError('StorageQuotaError')<{
  readonly message: string
}> {}

export class UnknownError extends Data.TaggedError('UnknownError')<{
  readonly message: string
  readonly cause?: unknown
}> {}

export type ResumableUploadError =
  | NetworkError
  | HttpError
  | InvalidResponseError
  | UploadAborted
  | UploadPaused
  | AlreadyInProgressError
  | FileTooLargeError
  | StorageQuotaError
  | UnknownError

export const isRetryableError = (error: ResumableUploadError): boolean => {
  if (error._tag === 'NetworkError') return true
  if (error._tag === 'HttpError') {
    const s = error.status
    return s === 408 || s === 429 || (s >= 500 && s < 600)
  }
  return false
}

export const isFatalError = (error: ResumableUploadError): boolean => {
  if (error._tag === 'UploadAborted' || error._tag === 'UploadPaused') return true
  if (error._tag === 'HttpError') {
    const s = error.status
    if (s === 408 || s === 429) return false
    if (s >= 400 && s < 500) return true
  }
  return false
}
