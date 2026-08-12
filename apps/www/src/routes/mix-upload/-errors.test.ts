import { describe, expect, test } from 'vitest'
import { ImageUploadError, isPageRetryable, MissingAudioError, RecordSaveError } from './-errors'

describe('isPageRetryable', () => {
  // Regression coverage: uploadImageDirectToS3 (lib/upload/image-upload.ts)
  // now attaches the failed response's real status to ImageUploadError via
  // HttpStatusError. Before that fix, status was always undefined and every
  // failure -- including permanent 4xx validation errors -- was retried
  // RETRY_TIMES, re-presigning and orphaning the previous pending
  // upload_assets row each time.
  test('retries transient upload and save failures but rejects permanent outcomes', () => {
    const cases = [
      [new ImageUploadError({ message: 'too large', status: 413 }), false],
      [new ImageUploadError({ message: 'timeout', status: 408 }), true],
      [new ImageUploadError({ message: 'rate limited', status: 429 }), true],
      [new ImageUploadError({ message: 'server error', status: 500 }), true],
      [new ImageUploadError({ message: 'network error' }), true],
      [new RecordSaveError({ message: 'conflict', status: 409 }), false],
      [new RecordSaveError({ message: 'server error', status: 502 }), true],
      [new MissingAudioError({ message: 'select a file' }), false]
    ] as const

    for (const [error, retryable] of cases) {
      expect(isPageRetryable(error)).toBe(retryable)
    }
  })
})
