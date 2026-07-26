import { describe, expect, test } from 'vitest'
import { ImageUploadError, isPageRetryable, RecordSaveError } from './-errors'

describe('isPageRetryable', () => {
  // Regression coverage: uploadImageDirectToS3 (lib/upload/image-upload.ts)
  // now attaches the failed response's real status to ImageUploadError via
  // HttpStatusError. Before that fix, status was always undefined and every
  // failure -- including permanent 4xx validation errors -- was retried
  // RETRY_TIMES, re-presigning and orphaning the previous pending
  // upload_assets row each time.
  test('treats a 4xx ImageUploadError as non-retryable', () => {
    expect(isPageRetryable(new ImageUploadError({ message: 'too large', status: 413 }))).toBe(false)
    expect(
      isPageRetryable(new ImageUploadError({ message: 'bad content-type', status: 415 }))
    ).toBe(false)
    expect(isPageRetryable(new ImageUploadError({ message: 'forbidden', status: 403 }))).toBe(false)
  })

  test('treats a 5xx ImageUploadError as retryable', () => {
    expect(isPageRetryable(new ImageUploadError({ message: 'server error', status: 500 }))).toBe(
      true
    )
    expect(isPageRetryable(new ImageUploadError({ message: 'unavailable', status: 503 }))).toBe(
      true
    )
  })

  test('treats 408 and 429 ImageUploadError as retryable', () => {
    expect(isPageRetryable(new ImageUploadError({ message: 'timeout', status: 408 }))).toBe(true)
    expect(isPageRetryable(new ImageUploadError({ message: 'rate limited', status: 429 }))).toBe(
      true
    )
  })

  test('treats a status-less ImageUploadError (network failure) as retryable', () => {
    expect(isPageRetryable(new ImageUploadError({ message: 'network error' }))).toBe(true)
  })

  test('applies the same classification to RecordSaveError', () => {
    expect(isPageRetryable(new RecordSaveError({ message: 'conflict', status: 409 }))).toBe(false)
    expect(isPageRetryable(new RecordSaveError({ message: 'server error', status: 502 }))).toBe(
      true
    )
  })
})
