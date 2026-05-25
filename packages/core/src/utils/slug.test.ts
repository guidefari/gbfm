import { describe, expect, test } from 'vitest'
import { MAX_SLUG_BASE_LENGTH, normalizeSlugBase } from './slug'

describe('normalizeSlugBase', () => {
  test('normalizes slug text', () => {
    expect(normalizeSlugBase('Burial & Four Tet!')).toBe('burial-four-tet')
  })

  test('truncates long slug bases', () => {
    const slug = normalizeSlugBase(
      'This is a very long title that should not keep going forever in the generated slug'
    )

    expect(slug).toBe('this-is-a-very-long-title-that-s')
    expect(slug.length).toBeLessThanOrEqual(MAX_SLUG_BASE_LENGTH)
  })
})
