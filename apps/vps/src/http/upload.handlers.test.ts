import { describe, expect, test } from 'vitest'
import { assertContiguousParts } from './upload.handlers'

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
