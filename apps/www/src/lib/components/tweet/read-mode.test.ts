import { expect, test } from 'vitest'

import { parseReadMode } from './read-mode'

test('defaults to unread for missing or unknown values', () => {
  expect(parseReadMode('all')).toBe('all')
  expect(parseReadMode('unread')).toBe('unread')
  expect(parseReadMode(undefined)).toBe('unread')
  expect(parseReadMode('everything')).toBe('unread')
})
