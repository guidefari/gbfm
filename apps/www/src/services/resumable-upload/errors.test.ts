import { describe, expect, test } from 'vitest'
import type { PersistedResumableUpload } from '@/lib/upload/resumable-upload'
import {
  AlreadyInProgressError,
  FileTooLargeError,
  HttpError,
  InvalidResponseError,
  NetworkError,
  StorageQuotaError,
  UnknownError,
  UploadAborted,
  UploadPaused,
  isFatalError,
  isRetryableError
} from './errors'

const pausedCheckpoint: PersistedResumableUpload = {
  fileFingerprint: 'fp',
  uploadId: 'u',
  key: 'k',
  chunkSize: 1,
  totalBytes: 0,
  totalParts: 0,
  contentType: 'audio/mpeg',
  fileName: 'f',
  completedParts: [],
  createdAt: 0,
  updatedAt: 0
}

describe('isRetryableError', () => {
  test('retries NetworkError', () => {
    expect(isRetryableError(new NetworkError({ message: 'down' }))).toBe(true)
  })

  test('retries HttpError on 408, 429, 5xx', () => {
    expect(isRetryableError(new HttpError({ status: 408, message: 'timeout' }))).toBe(true)
    expect(isRetryableError(new HttpError({ status: 429, message: 'rate' }))).toBe(true)
    expect(isRetryableError(new HttpError({ status: 500, message: 'oops' }))).toBe(true)
    expect(isRetryableError(new HttpError({ status: 599, message: 'oops' }))).toBe(true)
  })

  test('does not retry HttpError on 4xx other than 408/429', () => {
    expect(isRetryableError(new HttpError({ status: 400, message: 'bad' }))).toBe(false)
    expect(isRetryableError(new HttpError({ status: 401, message: 'unauth' }))).toBe(false)
    expect(isRetryableError(new HttpError({ status: 404, message: 'gone' }))).toBe(false)
  })

  test('does not retry user-controlled outcomes', () => {
    expect(isRetryableError(new UploadAborted())).toBe(false)
    expect(isRetryableError(new UploadPaused({ checkpoint: pausedCheckpoint }))).toBe(false)
    expect(isRetryableError(new InvalidResponseError({ message: 'bad json' }))).toBe(false)
    expect(isRetryableError(new FileTooLargeError({ maxBytes: 1, actualBytes: 2 }))).toBe(false)
    expect(isRetryableError(new StorageQuotaError({ message: 'full' }))).toBe(false)
    expect(isRetryableError(new AlreadyInProgressError({ message: 'busy' }))).toBe(false)
    expect(isRetryableError(new UnknownError({ message: 'oops' }))).toBe(false)
  })
})

describe('isFatalError', () => {
  test('marks UploadAborted and UploadPaused as fatal', () => {
    expect(isFatalError(new UploadAborted())).toBe(true)
    expect(isFatalError(new UploadPaused({ checkpoint: pausedCheckpoint }))).toBe(true)
  })

  test('marks 401, 403, 413, 415 as fatal', () => {
    expect(isFatalError(new HttpError({ status: 401, message: 'unauth' }))).toBe(true)
    expect(isFatalError(new HttpError({ status: 403, message: 'forbid' }))).toBe(true)
    expect(isFatalError(new HttpError({ status: 413, message: 'large' }))).toBe(true)
    expect(isFatalError(new HttpError({ status: 415, message: 'type' }))).toBe(true)
  })

  test('does not mark 5xx as fatal', () => {
    expect(isFatalError(new HttpError({ status: 500, message: 'oops' }))).toBe(false)
    expect(isFatalError(new HttpError({ status: 503, message: 'unavail' }))).toBe(false)
  })

  test('does not mark 408/429 as fatal', () => {
    expect(isFatalError(new HttpError({ status: 408, message: 'timeout' }))).toBe(false)
    expect(isFatalError(new HttpError({ status: 429, message: 'rate' }))).toBe(false)
  })
})
