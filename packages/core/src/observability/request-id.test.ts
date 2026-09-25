import { describe, expect, test } from 'vitest'

import { resolveRequestId } from './request-id'

describe('resolveRequestId', () => {
  test('retains bounded caller correlation IDs', () => {
    expect(resolveRequestId('www_request-123', () => 'generated')).toBe('www_request-123')
  })

  test.each([null, '', 'contains spaces', 'x'.repeat(129)])(
    'generates an ID for missing or unsafe input %#',
    (incoming) => {
      expect(resolveRequestId(incoming, () => 'generated')).toBe('generated')
    },
  )
})
