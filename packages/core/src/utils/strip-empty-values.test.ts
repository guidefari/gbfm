import { describe, expect, test } from 'vitest'
import { stripEmptyValues } from './strip-empty-values'

describe('stripEmptyValues', () => {
  test('removes empty strings', () => {
    const input = {
      name: 'John',
      email: '',
      age: 25
    }

    const result = stripEmptyValues(input)

    expect(result).toEqual({
      name: 'John',
      age: 25
    })
  })

  test('removes strings with only whitespace', () => {
    const input = {
      name: 'John',
      bio: '   ',
      location: 'NYC'
    }

    const result = stripEmptyValues(input)

    expect(result).toEqual({
      name: 'John',
      location: 'NYC'
    })
  })

  test('removes null values', () => {
    const input = {
      name: 'John',
      email: null,
      age: 25
    }

    const result = stripEmptyValues(input)

    expect(result).toEqual({
      name: 'John',
      age: 25
    })
  })

  test('removes empty arrays', () => {
    const input = {
      name: 'John',
      tags: [],
      age: 25
    }

    const result = stripEmptyValues(input)

    expect(result).toEqual({
      name: 'John',
      age: 25
    })
  })

  test('keeps arrays with non-empty values', () => {
    const input = {
      name: 'John',
      tags: ['developer', 'typescript'],
      age: 25
    }

    const result = stripEmptyValues(input)

    expect(result).toEqual({
      name: 'John',
      tags: ['developer', 'typescript'],
      age: 25
    })
  })

  test('filters empty strings from arrays', () => {
    const input = {
      name: 'John',
      tags: ['developer', '', 'typescript', '   '],
      age: 25
    }

    const result = stripEmptyValues(input)

    expect(result).toEqual({
      name: 'John',
      tags: ['developer', 'typescript'],
      age: 25
    })
  })

  test('removes array that becomes empty after filtering', () => {
    const input = {
      name: 'John',
      tags: ['', '   ', null],
      age: 25
    }

    const result = stripEmptyValues(input)

    expect(result).toEqual({
      name: 'John',
      age: 25
    })
  })

  test('keeps boolean false values', () => {
    const input = {
      name: 'John',
      active: false,
      verified: true
    }

    const result = stripEmptyValues(input)

    expect(result).toEqual({
      name: 'John',
      active: false,
      verified: true
    })
  })

  test('keeps number zero', () => {
    const input = {
      name: 'John',
      score: 0,
      age: 25
    }

    const result = stripEmptyValues(input)

    expect(result).toEqual({
      name: 'John',
      score: 0,
      age: 25
    })
  })

  test('handles complex label object with multiple empty types', () => {
    const input = {
      title: 'Test Label',
      description: '',
      slug: 'test-label',
      website: '   ',
      bandcamp: null,
      genres: ['house', '', 'techno'],
      tags: [],
      draft: false
    }

    const result = stripEmptyValues(input)

    expect(result).toEqual({
      title: 'Test Label',
      slug: 'test-label',
      genres: ['house', 'techno'],
      draft: false
    })
  })

  test('returns empty object when all values are empty', () => {
    const input = {
      name: '',
      email: '   ',
      tags: [],
      bio: null
    }

    const result = stripEmptyValues(input)

    expect(result).toEqual({})
  })

  test('handles empty object input', () => {
    const input = {}

    const result = stripEmptyValues(input)

    expect(result).toEqual({})
  })
})
