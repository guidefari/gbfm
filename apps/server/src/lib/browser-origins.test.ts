import { describe, expect, test } from 'vitest'

import { browserOrigins } from './browser-origins'

describe('browserOrigins', () => {
  test('returns one shared, de-duplicated allowlist', () => {
    expect(browserOrigins('https://goosebumps.fm')).toEqual([
      'https://goosebumps.fm',
      'http://127.0.0.1:5173',
      'http://localhost:5173',
      'http://localhost:4173',
      'http://127.0.0.1:3003',
      'http://localhost:3003',
      'https://gbfm.localhost',
      'https://gbfm.test',
      'https://www.goosebumps.fm',
    ])
  })
})
