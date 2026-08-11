import { expect, test } from 'vitest'
import { normalizeSlugBase } from './slug'

test('normalizes and bounds a slug base', () => {
  expect(normalizeSlugBase('Burial & Four Tet!')).toBe('burial-four-tet')

  const slug = normalizeSlugBase(
    'This is a very long title that should not keep going forever in the generated slug'
  )
  expect(slug).toBe('this-is-a-very-long-title-that-s')
})
