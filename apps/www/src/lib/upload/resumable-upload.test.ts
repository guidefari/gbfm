import { describe, expect, test } from 'vitest'
import {
  computeBackoff,
  computeFileFingerprint,
  createPersistedUpload,
  isRetryableStatus,
  mergeCompletedParts,
  missingPartNumbers,
  parseAbortResponse,
  parseCompleteResponse,
  parseInitResponse,
  parsePartResponse,
  parsePersistedUpload,
  parsePresignPartResponse,
  parseStatusResponse,
  splitFileIntoChunks,
  totalParts,
  withUpdatedPart
} from './resumable-upload'

const makeFile = (size: number, name = 'mix.mp3', lastModified = 1_700_000_000_000): File => {
  const blob = new Blob([new Uint8Array(size)], { type: 'audio/mpeg' })
  return new File([blob], name, { type: 'audio/mpeg', lastModified })
}

describe('computeFileFingerprint', () => {
  test('combines size, name, and lastModified', () => {
    const file = makeFile(123, 'a.mp3', 42)
    expect(computeFileFingerprint(file)).toBe('123:a.mp3:42')
  })

  test('differs when any component differs', () => {
    const a = makeFile(100, 'a.mp3', 1)
    const b = makeFile(100, 'b.mp3', 1)
    const c = makeFile(100, 'a.mp3', 2)
    const d = makeFile(101, 'a.mp3', 1)
    expect(new Set([a, b, c, d].map(computeFileFingerprint)).size).toBe(4)
  })
})

describe('splitFileIntoChunks', () => {
  test('returns a single chunk when file fits', () => {
    const file = makeFile(5)
    const chunks = splitFileIntoChunks(file, 10)
    expect(chunks).toHaveLength(1)
    expect(chunks[0]?.partNumber).toBe(1)
    expect(chunks[0]?.start).toBe(0)
    expect(chunks[0]?.end).toBe(5)
  })

  test('splits into even chunks', () => {
    const file = makeFile(100)
    const chunks = splitFileIntoChunks(file, 25)
    expect(chunks).toHaveLength(4)
    expect(chunks.map((c) => c.partNumber)).toEqual([1, 2, 3, 4])
    expect(chunks[0]?.start).toBe(0)
    expect(chunks[3]?.end).toBe(100)
  })

  test('keeps the last chunk smaller when not aligned', () => {
    const file = makeFile(105)
    const chunks = splitFileIntoChunks(file, 25)
    expect(chunks).toHaveLength(5)
    expect(chunks[3]?.end).toBe(100)
    expect(chunks[4]?.end).toBe(105)
    expect(chunks[4]?.blob.size).toBe(5)
  })

  test('rejects non-positive chunk size', () => {
    const file = makeFile(10)
    expect(() => splitFileIntoChunks(file, 0)).toThrow()
    expect(() => splitFileIntoChunks(file, -1)).toThrow()
  })
})

describe('totalParts', () => {
  test('handles exact multiples', () => {
    expect(totalParts(100, 10)).toBe(10)
  })

  test('rounds up partial chunks', () => {
    expect(totalParts(101, 10)).toBe(11)
  })

  test('returns 0 for empty files', () => {
    expect(totalParts(0, 10)).toBe(0)
  })
})

describe('mergeCompletedParts', () => {
  test('unions multiple sources by partNumber', () => {
    const merged = mergeCompletedParts(
      [{ partNumber: 1, etag: 'a', size: 10 }],
      [{ partNumber: 2, etag: 'b', size: 20 }]
    )
    expect(merged).toEqual([
      { partNumber: 1, etag: 'a', size: 10 },
      { partNumber: 2, etag: 'b', size: 20 }
    ])
  })

  test('last write wins on duplicates', () => {
    const merged = mergeCompletedParts(
      [{ partNumber: 1, etag: 'old', size: 10 }],
      [{ partNumber: 1, etag: 'new', size: 12 }]
    )
    expect(merged).toEqual([{ partNumber: 1, etag: 'new', size: 12 }])
  })

  test('sorts the result by partNumber', () => {
    const merged = mergeCompletedParts(
      [{ partNumber: 3, etag: 'c', size: 30 }],
      [{ partNumber: 1, etag: 'a', size: 10 }],
      [{ partNumber: 2, etag: 'b', size: 20 }]
    )
    expect(merged.map((p) => p.partNumber)).toEqual([1, 2, 3])
  })
})

describe('missingPartNumbers', () => {
  test('returns the gap in the sequence', () => {
    expect(missingPartNumbers(5, [{ partNumber: 1, etag: 'a', size: 1 }])).toEqual([2, 3, 4, 5])
  })

  test('returns empty when complete', () => {
    expect(
      missingPartNumbers(3, [
        { partNumber: 1, etag: 'a', size: 1 },
        { partNumber: 2, etag: 'b', size: 1 },
        { partNumber: 3, etag: 'c', size: 1 }
      ])
    ).toEqual([])
  })
})

describe('computeBackoff', () => {
  test('grows exponentially with attempt number', () => {
    const a = computeBackoff(1, 1000, 60_000)
    const b = computeBackoff(2, 1000, 60_000)
    const c = computeBackoff(3, 1000, 60_000)
    expect(b).toBeGreaterThan(a)
    expect(c).toBeGreaterThan(b)
  })

  test('caps at the max', () => {
    expect(computeBackoff(20, 1000, 5000)).toBeLessThanOrEqual(5000)
  })

  test('includes jitter', () => {
    const samples = Array.from({ length: 20 }, () => computeBackoff(1, 1000, 60_000))
    const unique = new Set(samples)
    expect(unique.size).toBeGreaterThan(1)
  })
})

describe('isRetryableStatus', () => {
  test('treats 408 and 429 as retryable', () => {
    expect(isRetryableStatus(408)).toBe(true)
    expect(isRetryableStatus(429)).toBe(true)
  })

  test('treats 5xx as retryable', () => {
    expect(isRetryableStatus(500)).toBe(true)
    expect(isRetryableStatus(503)).toBe(true)
    expect(isRetryableStatus(599)).toBe(true)
  })

  test('does not treat 4xx other than 408/429 as retryable', () => {
    expect(isRetryableStatus(400)).toBe(false)
    expect(isRetryableStatus(401)).toBe(false)
    expect(isRetryableStatus(404)).toBe(false)
    expect(isRetryableStatus(422)).toBe(false)
  })

  test('does not treat 2xx or 3xx as retryable', () => {
    expect(isRetryableStatus(200)).toBe(false)
    expect(isRetryableStatus(301)).toBe(false)
  })
})

describe('createPersistedUpload', () => {
  test('seeds the persisted record with no completed parts', () => {
    const file = makeFile(50_000_000)
    const persisted = createPersistedUpload({
      file,
      fileFingerprint: computeFileFingerprint(file),
      init: { uploadId: 'u-1', key: 'audio_x.mp3', chunkSize: 10_000_000 },
      now: 1_000
    })
    expect(persisted).toMatchObject({
      fileFingerprint: computeFileFingerprint(file),
      uploadId: 'u-1',
      key: 'audio_x.mp3',
      chunkSize: 10_000_000,
      totalBytes: 50_000_000,
      totalParts: 5,
      contentType: 'audio/mpeg',
      fileName: 'mix.mp3',
      createdAt: 1_000,
      updatedAt: 1_000
    })
    expect(persisted.completedParts).toEqual([])
  })
})

describe('withUpdatedPart', () => {
  test('appends a new part and sorts', () => {
    const file = makeFile(100)
    const persisted = createPersistedUpload({
      file,
      fileFingerprint: computeFileFingerprint(file),
      init: { uploadId: 'u', key: 'k', chunkSize: 50 }
    })
    const next = withUpdatedPart(persisted, { partNumber: 2, etag: 'b', size: 50 })
    expect(next.completedParts).toEqual([{ partNumber: 2, etag: 'b', size: 50 }])

    const appended = withUpdatedPart(next, { partNumber: 1, etag: 'a', size: 50 })
    expect(appended.completedParts.map((p) => p.partNumber)).toEqual([1, 2])
  })

  test('replaces an existing part', () => {
    const file = makeFile(100)
    const persisted = createPersistedUpload({
      file,
      fileFingerprint: computeFileFingerprint(file),
      init: { uploadId: 'u', key: 'k', chunkSize: 50 }
    })
    const after1 = withUpdatedPart(persisted, { partNumber: 1, etag: 'old', size: 50 })
    const after2 = withUpdatedPart(after1, { partNumber: 1, etag: 'new', size: 51 })
    expect(after2.completedParts).toEqual([{ partNumber: 1, etag: 'new', size: 51 }])
  })

  test('updates the updatedAt timestamp', () => {
    const file = makeFile(100)
    const persisted = createPersistedUpload({
      file,
      fileFingerprint: computeFileFingerprint(file),
      init: { uploadId: 'u', key: 'k', chunkSize: 50 },
      now: 1_000
    })
    const next = withUpdatedPart(persisted, { partNumber: 1, etag: 'a', size: 50 }, 2_000)
    expect(next.updatedAt).toBe(2_000)
  })
})

describe('response parsers', () => {
  test('parseInitResponse decodes a valid payload', () => {
    expect(parseInitResponse({ uploadId: 'u', key: 'k', chunkSize: 10 })).toEqual({
      uploadId: 'u',
      key: 'k',
      chunkSize: 10
    })
  })

  test('parseInitResponse throws on missing fields', () => {
    expect(() => parseInitResponse({ uploadId: 'u', key: 'k' })).toThrow()
  })

  test('parsePartResponse decodes a valid payload', () => {
    expect(parsePartResponse({ partNumber: 1, etag: 'e', size: 10 })).toEqual({
      partNumber: 1,
      etag: 'e',
      size: 10
    })
  })

  test('parsePresignPartResponse decodes a valid payload', () => {
    expect(
      parsePresignPartResponse({
        url: 'https://bucket.s3.amazonaws.com/key?X-Amz-Signature=abc',
        partNumber: 1,
        expiresInSeconds: 300
      })
    ).toEqual({
      url: 'https://bucket.s3.amazonaws.com/key?X-Amz-Signature=abc',
      partNumber: 1,
      expiresInSeconds: 300
    })
  })

  test('parsePresignPartResponse throws on missing fields', () => {
    expect(() => parsePresignPartResponse({ partNumber: 1 })).toThrow()
  })

  test('parseStatusResponse returns a fresh array', () => {
    const decoded = parseStatusResponse({ parts: [{ partNumber: 1, etag: 'e', size: 10 }] })
    expect(decoded.parts).toEqual([{ partNumber: 1, etag: 'e', size: 10 }])
    expect(() => {
      decoded.parts.push({ partNumber: 2, etag: 'x', size: 1 })
    }).not.toThrow()
  })

  test('parseStatusResponse throws on non-array parts', () => {
    expect(() => parseStatusResponse({ parts: 'nope' })).toThrow()
  })

  test('parseAbortResponse requires ok: true', () => {
    expect(parseAbortResponse({ ok: true })).toEqual({ ok: true })
    expect(() => parseAbortResponse({ ok: false })).toThrow()
  })

  test('parseCompleteResponse decodes the result', () => {
    expect(parseCompleteResponse({ url: 'https://x', key: 'k' })).toEqual({
      url: 'https://x',
      key: 'k'
    })
  })

  test('parsePersistedUpload returns null on bad data', () => {
    expect(parsePersistedUpload({ nope: true })).toBeNull()
    expect(parsePersistedUpload('not an object')).toBeNull()
    expect(parsePersistedUpload(null)).toBeNull()
  })

  test('parsePersistedUpload returns a fresh parts array', () => {
    const decoded = parsePersistedUpload({
      fileFingerprint: '1:a:1',
      uploadId: 'u',
      key: 'k',
      chunkSize: 10,
      totalBytes: 100,
      totalParts: 10,
      contentType: 'audio/mpeg',
      fileName: 'a.mp3',
      completedParts: [{ partNumber: 1, etag: 'e', size: 10 }],
      createdAt: 0,
      updatedAt: 0
    })
    if (!decoded) throw new Error('expected parsed upload')
    decoded.completedParts.push({ partNumber: 2, etag: 'x', size: 10 })
    expect(decoded.completedParts).toHaveLength(2)
  })
})
