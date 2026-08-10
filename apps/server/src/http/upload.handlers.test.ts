import { Effect } from 'effect'
import { HttpApiError } from 'effect/unstable/httpapi'
import { describe, expect, test } from 'vitest'
import {
  assertContiguousParts,
  assertKeyOwnership,
  expectedMultipartPartSize,
  matchesCompletedObject,
  validateMultipartParts
} from './upload.handlers'

describe('assertKeyOwnership', () => {
  test('accepts a key prefixed with the requesting user id', () => {
    expect(assertKeyOwnership('user-1', 'user-1/multipart/uuid/1024/audio_test.mp3')).toBe(
      Effect.void
    )
  })

  test('rejects a key prefixed with a different user id', () => {
    expect(
      assertKeyOwnership('user-1', 'user-2/multipart/uuid/1024/audio_test.mp3')
    ).toBeInstanceOf(HttpApiError.BadRequest)
  })

  test('rejects a key with no matching prefix segment at all', () => {
    expect(assertKeyOwnership('user-1', 'not-a-scoped-key.mp3')).toBeInstanceOf(
      HttpApiError.BadRequest
    )
  })

  test('sanitizes the user id the same way keys are built, so ownership matches sanitized ids', () => {
    expect(assertKeyOwnership('user 1!', 'user_1_/multipart/uuid/1024/audio_test.mp3')).toBe(
      Effect.void
    )
  })

  test('rejects a prefix match that stops short of the path separator', () => {
    expect(
      assertKeyOwnership('user-1', 'user-12/multipart/uuid/1024/audio_test.mp3')
    ).toBeInstanceOf(HttpApiError.BadRequest)
  })
})

describe('assertContiguousParts', () => {
  test('accepts a complete contiguous sequence', () => {
    expect(
      assertContiguousParts([{ partNumber: 1 }, { partNumber: 2 }, { partNumber: 3 }])
    ).toBeNull()
  })

  test('accepts a single-part upload', () => {
    expect(assertContiguousParts([{ partNumber: 1 }])).toBeNull()
  })

  test('sorts before checking', () => {
    expect(
      assertContiguousParts([{ partNumber: 3 }, { partNumber: 1 }, { partNumber: 2 }])
    ).toBeNull()
  })

  test('rejects when the first part is missing', () => {
    expect(assertContiguousParts([{ partNumber: 2 }, { partNumber: 3 }])).not.toBeNull()
  })

  test('rejects when a middle part is missing', () => {
    expect(
      assertContiguousParts([{ partNumber: 1 }, { partNumber: 2 }, { partNumber: 4 }])
    ).not.toBeNull()
  })

  test('rejects duplicate part numbers', () => {
    expect(
      assertContiguousParts([{ partNumber: 1 }, { partNumber: 2 }, { partNumber: 2 }])
    ).not.toBeNull()
  })
})

describe('multipart size validation', () => {
  const chunkSize = 8 * 1024 * 1024

  test('requires the exact part count and exact final part length', () => {
    const expectedSize = chunkSize * 2 + 17
    expect(
      validateMultipartParts(expectedSize, [
        { partNumber: 1, size: chunkSize },
        { partNumber: 2, size: chunkSize },
        { partNumber: 3, size: 17 }
      ])
    ).toBeNull()
    expect(
      validateMultipartParts(expectedSize, [
        { partNumber: 1, size: chunkSize },
        { partNumber: 2, size: chunkSize },
        { partNumber: 3, size: 18 }
      ])
    ).not.toBeNull()
  })

  test('rejects extra parts even when each part is under the request limit', () => {
    expect(
      validateMultipartParts(chunkSize, [
        { partNumber: 1, size: chunkSize },
        { partNumber: 2, size: 1 }
      ])
    ).not.toBeNull()
  })

  test('derives only valid part sizes from the trusted expected total', () => {
    expect(expectedMultipartPartSize(chunkSize + 5, 1)).toBe(chunkSize)
    expect(expectedMultipartPartSize(chunkSize + 5, 2)).toBe(5)
    expect(expectedMultipartPartSize(chunkSize + 5, 3)).toBeNull()
  })

  test('reconciles completion only when final size and init metadata both match', () => {
    const completed = { size: 42, metadata: { 'expected-size': '42' } }
    expect(matchesCompletedObject(42, completed)).toBe(true)
    expect(matchesCompletedObject(41, completed)).toBe(false)
    expect(matchesCompletedObject(42, { size: 42, metadata: {} })).toBe(false)
    expect(matchesCompletedObject(42, null)).toBe(false)
  })
})
