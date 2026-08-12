import { describe, expect, test } from 'vitest'
import { makeApiUrl, makeApiUrlObj, makePublicUrl, makePublicUrlObj } from './http-url'

describe('http URL helpers', () => {
  test('builds API and public URLs for browser-relative and configured server environments', () => {
    expect(makeApiUrl('/favorites', '')).toBe('/api/favorites')
    expect(makeApiUrl('/favorites', 'https://vps.goosebumps.fm')).toBe(
      'https://vps.goosebumps.fm/api/favorites'
    )
    expect(makeApiUrlObj('/favorites', '', 'https://www.goosebumps.fm').toString()).toBe(
      'https://www.goosebumps.fm/api/favorites'
    )
    expect(
      makeApiUrlObj(
        '/favorites',
        'https://vps.goosebumps.fm',
        'https://www.goosebumps.fm'
      ).toString()
    ).toBe('https://vps.goosebumps.fm/api/favorites')
    expect(makePublicUrl('/images/a.jpg', '')).toBe('/images/a.jpg')
    expect(makePublicUrl('/images/a.jpg', 'https://vps.goosebumps.fm')).toBe(
      'https://vps.goosebumps.fm/images/a.jpg'
    )
    expect(makePublicUrlObj('/images/a.jpg', '', 'https://www.goosebumps.fm').toString()).toBe(
      'https://www.goosebumps.fm/images/a.jpg'
    )
    expect(
      makePublicUrlObj(
        '/images/a.jpg',
        'https://vps.goosebumps.fm',
        'https://www.goosebumps.fm'
      ).toString()
    ).toBe('https://vps.goosebumps.fm/images/a.jpg')
  })
})
