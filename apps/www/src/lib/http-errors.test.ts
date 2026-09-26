import { HttpApiError } from 'effect/unstable/httpapi'
import { describe, expect, it } from 'vitest'

import { isNotFoundError } from './http-errors'

describe('isNotFoundError', () => {
  it('recognizes only the typed HTTP API not-found error', () => {
    expect(isNotFoundError(new HttpApiError.NotFound())).toBe(true)
    expect(isNotFoundError(new Error('HTTP 404: Not found'))).toBe(false)
  })
})
