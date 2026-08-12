import { expect, test } from 'vitest'
import { traceSampleRate } from './trace-sampling'

test('reduces crawler noise, preserves business traces, and otherwise uses the baseline rate', () => {
  expect(
    ['/health', '/robots.txt', '/sitemap.xml'].map((url) =>
      traceSampleRate({ name: `GET ${url}`, url })
    )
  ).toEqual([0.01, 0.01, 0.01])

  expect(
    ['/api/profile/guidefari', '/api/music/track/123', '/auth/get-session'].map((url) =>
      traceSampleRate({ name: `GET ${url}`, url })
    )
  ).toEqual([0.5, 0.5, 0.5])

  expect(traceSampleRate({ name: 'pageload', url: '/about' })).toBe(0.2)
  expect(traceSampleRate({ name: 'GET /health', url: '/api/music/track/123' })).toBe(0.5)
})
