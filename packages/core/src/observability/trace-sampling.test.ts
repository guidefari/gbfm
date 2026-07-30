import { describe, expect, test } from 'vitest'
import { traceSampleRate } from './trace-sampling'

describe('traceSampleRate', () => {
  test.each(['/health', '/robots.txt', '/sitemap.xml'])(
    'samples noisy route %s at one percent',
    (url) => {
      expect(traceSampleRate({ name: `GET ${url}`, url })).toBe(0.01)
    }
  )

  test.each(['/api/profile/guidefari', '/api/music/track/123', '/auth/get-session'])(
    'keeps representative business traffic for %s',
    (url) => {
      expect(traceSampleRate({ name: `GET ${url}`, url })).toBe(0.5)
    }
  )

  test('samples other traffic at the baseline rate', () => {
    expect(traceSampleRate({ name: 'pageload', url: '/about' })).toBe(0.2)
  })
})
