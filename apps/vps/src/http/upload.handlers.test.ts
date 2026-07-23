import { describe, expect, test } from 'vitest'
import {
  assertContiguousParts,
  expectedMultipartPartSize,
  matchesCompletedObject,
  validateMultipartParts
} from './upload.handlers'

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
