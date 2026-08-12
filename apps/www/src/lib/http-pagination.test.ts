import { describe, expect, test } from 'vitest'
import { DEFAULT_PAGE_SIZE, getNextOffsetPageParam, setPaginationParams } from './http-pagination'

describe('http pagination helpers', () => {
  test('applies default or explicit pagination parameters to request URLs', () => {
    const defaultPage = new URL('https://www.goosebumps.fm/api/content/audio/mix')
    const customPage = new URL('https://www.goosebumps.fm/api/content/audio/mix')

    setPaginationParams(defaultPage, 10)
    setPaginationParams(customPage, 15, { limit: 20 })

    expect(defaultPage.searchParams.get('limit')).toBe(String(DEFAULT_PAGE_SIZE))
    expect(defaultPage.searchParams.get('offset')).toBe('10')
    expect(customPage.searchParams.get('limit')).toBe('20')
    expect(customPage.searchParams.get('offset')).toBe('15')
  })

  test('advances by the page size only while more pages exist', () => {
    expect(
      getNextOffsetPageParam({
        data: ['mix'],
        pagination: { total: 10, limit: 5, offset: 5, hasMore: true }
      })
    ).toBe(10)
    expect(
      getNextOffsetPageParam({
        data: ['mix'],
        pagination: { total: 5, limit: 5, offset: 0, hasMore: false }
      })
    ).toBeUndefined()
  })
})
