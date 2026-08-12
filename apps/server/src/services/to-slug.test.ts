import { expect, test } from 'vitest'
import { getSlugSuffix, stripSlugSuffix, toSlug } from './to-slug'

test('generates unique URL-safe slugs for the titles users submit', () => {
  const userTitles = [
    ['Burial', 'burial'],
    ['Four Tet', 'four-tet'],
    ['Burial & Four Tet!', 'burial-four-tet'],
    ['Burial --- Four Tet', 'burial-four-tet'],
    ['---Burial---', 'burial'],
    ['Björk', 'bj-rk'],
    ['Album 2024', 'album-2024'],
    ['!!!', 'item']
  ] as const

  for (const [title, expectedBase] of userTitles) {
    const slug = toSlug(title)
    expect(stripSlugSuffix(slug)).toBe(expectedBase)
    expect(getSlugSuffix(slug)).toMatch(/^[a-f0-9]{8}$/)
  }

  const longTitle = 'This is a very long title that should not keep going forever in the generated slug'
  expect(stripSlugSuffix(toSlug(longTitle))).toBe('this-is-a-very-long-title-that-s')

  const first = toSlug('Same Title')
  const second = toSlug('Same Title')
  expect(first).not.toBe(second)
  expect(stripSlugSuffix(first)).toBe(stripSlugSuffix(second))
})
