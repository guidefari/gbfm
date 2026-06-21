import { describe, expect, test } from 'vitest'
import { makeApiUrl, makeApiUrlObj, makePublicUrl, makePublicUrlObj } from './http-url'

describe('http URL helpers', () => {
  test('builds relative API URLs when no base URL is configured', () => {
    expect(makeApiUrl('/favorites', '')).toBe('/api/favorites')
  })

  test('builds absolute API URLs when a base URL is configured', () => {
    expect(makeApiUrl('/favorites', 'https://vps.goosebumps.fm')).toBe(
      'https://vps.goosebumps.fm/api/favorites'
    )
  })

  test('builds API URL objects against the browser origin fallback', () => {
    expect(makeApiUrlObj('/favorites', '', 'https://www.goosebumps.fm').toString()).toBe(
      'https://www.goosebumps.fm/api/favorites'
    )
  })

  test('builds public URLs without the API prefix', () => {
    expect(makePublicUrl('/images/a.jpg', 'https://vps.goosebumps.fm')).toBe(
      'https://vps.goosebumps.fm/images/a.jpg'
    )
  })

  test('builds public URL objects against the browser origin fallback', () => {
    expect(makePublicUrlObj('/images/a.jpg', '', 'https://www.goosebumps.fm').toString()).toBe(
      'https://www.goosebumps.fm/images/a.jpg'
    )
  })
})
