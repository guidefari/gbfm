import { describe, expect, test } from 'vitest'
import { rateLimitClientKey } from './global-middleware'

describe('rateLimitClientKey', () => {
  test('uses the first ip from x-forwarded-for', () => {
    expect(rateLimitClientKey({ 'x-forwarded-for': '1.1.1.1, 2.2.2.2' })).toBe('1.1.1.1')
  })

  test('trims whitespace around the forwarded ip', () => {
    expect(rateLimitClientKey({ 'x-forwarded-for': '  3.3.3.3  ' })).toBe('3.3.3.3')
  })

  test('falls back to x-real-ip when no forwarded header', () => {
    expect(rateLimitClientKey({ 'x-real-ip': '4.4.4.4' })).toBe('4.4.4.4')
  })

  test('returns unknown when no ip headers are present', () => {
    expect(rateLimitClientKey({})).toBe('unknown')
  })
})
