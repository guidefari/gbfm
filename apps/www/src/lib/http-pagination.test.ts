import { describe, expect, test } from 'vitest'
import { DEFAULT_PAGE_SIZE, getNextOffsetPageParam, setPaginationParams } from './http-pagination'

describe('http pagination helpers', () => {
  test('sets default limit and offset search params', () => {
    const url = new URL('https://www.goosebumps.fm/api/content/audio/mix')

    setPaginationParams(url, 10)

    expect(url.searchParams.get('limit')).toBe(String(DEFAULT_PAGE_SIZE))
    expect(url.searchParams.get('offset')).toBe('10')
  })

  test('sets explicit limit and offset search params', () => {
    const url = new URL('https://www.goosebumps.fm/api/content/audio/mix')

    setPaginationParams(url, 15, { limit: 20 })

    expect(url.searchParams.get('limit')).toBe('20')
    expect(url.searchParams.get('offset')).toBe('15')
  })

  test('returns the next offset when more pages exist', () => {
    expect(
      getNextOffsetPageParam({
        data: ['mix'],
        pagination: { total: 10, limit: 5, offset: 5, hasMore: true }
      })
    ).toBe(10)
  })

  test('returns undefined when no more pages exist', () => {
    expect(
      getNextOffsetPageParam({
        data: ['mix'],
        pagination: { total: 5, limit: 5, offset: 0, hasMore: false }
      })
    ).toBeUndefined()
  })
})
