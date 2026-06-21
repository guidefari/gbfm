import { describe, expect, test } from 'vitest'
import { ValidationError } from '@/errors'
import { assertContiguousParts } from './upload-multipart.handlers'

describe('assertContiguousParts', () => {
  test('accepts a complete contiguous sequence', () => {
    expect(() =>
      assertContiguousParts([{ partNumber: 1 }, { partNumber: 2 }, { partNumber: 3 }])
    ).not.toThrow()
  })

  test('accepts a single-part upload', () => {
    expect(() => assertContiguousParts([{ partNumber: 1 }])).not.toThrow()
  })

  test('sorts before checking', () => {
    expect(() =>
      assertContiguousParts([{ partNumber: 3 }, { partNumber: 1 }, { partNumber: 2 }])
    ).not.toThrow()
  })

  test('rejects when the first part is missing', () => {
    expect(() => assertContiguousParts([{ partNumber: 2 }, { partNumber: 3 }])).toThrow(
      ValidationError
    )
  })

  test('rejects when a middle part is missing', () => {
    expect(() =>
      assertContiguousParts([{ partNumber: 1 }, { partNumber: 2 }, { partNumber: 4 }])
    ).toThrow(ValidationError)
  })

  test('rejects duplicate part numbers', () => {
    expect(() =>
      assertContiguousParts([{ partNumber: 1 }, { partNumber: 2 }, { partNumber: 2 }])
    ).toThrow(ValidationError)
  })

  test('error message names the missing part', () => {
    expect(() => assertContiguousParts([{ partNumber: 1 }, { partNumber: 3 }])).toThrow(
      new ValidationError({
        message: 'Parts must be contiguous starting at 1. Missing part 2'
      })
    )
  })
})
