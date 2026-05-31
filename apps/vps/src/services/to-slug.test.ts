import { describe, expect, test } from 'vitest'
import { getSlugSuffix, stripSlugSuffix, toSlug } from './to-slug'

describe('toSlug', () => {
  test('lowercases text', () => {
    expect(stripSlugSuffix(toSlug('Burial'))).toBe('burial')
  })

  test('replaces spaces with hyphens', () => {
    expect(stripSlugSuffix(toSlug('Four Tet'))).toBe('four-tet')
  })

  test('replaces special characters with hyphens', () => {
    expect(stripSlugSuffix(toSlug('Burial & Four Tet!'))).toBe('burial-four-tet')
  })

  test('collapses consecutive special chars into single hyphen', () => {
    expect(stripSlugSuffix(toSlug('Burial --- Four Tet'))).toBe('burial-four-tet')
  })

  test('strips leading and trailing hyphens before suffix', () => {
    expect(stripSlugSuffix(toSlug('---Burial---'))).toBe('burial')
  })

  test('handles unicode characters', () => {
    expect(stripSlugSuffix(toSlug('Björk'))).toBe('bj-rk')
  })

  test('appends an 8-character suffix', () => {
    const suffix = getSlugSuffix(toSlug('test'))
    expect(suffix).toHaveLength(8)
  })

  test('generates unique slugs for same input', () => {
    const slug1 = toSlug('Same Title')
    const slug2 = toSlug('Same Title')
    expect(slug1).not.toBe(slug2)
    expect(stripSlugSuffix(slug1)).toBe(stripSlugSuffix(slug2))
  })

  test('handles numbers', () => {
    expect(stripSlugSuffix(toSlug('Album 2024'))).toBe('album-2024')
  })

  test('truncates long slug bases', () => {
    const slugBase = stripSlugSuffix(
      toSlug('This is a very long title that should not keep going forever in the generated slug')
    )

    expect(slugBase).toBe('this-is-a-very-long-title-that-s')
    expect(slugBase.length).toBeLessThanOrEqual(32)
  })

  test('falls back when the text has no slug characters', () => {
    expect(stripSlugSuffix(toSlug('!!!'))).toBe('item')
  })
})
