import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { InMemoryRateLimiter } from './rate-limiter'

describe('InMemoryRateLimiter.check', () => {
  const config = { windowMs: 1000, maxRequests: 3 }

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(0)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  test('allows the first request and reports remaining count', () => {
    const limiter = new InMemoryRateLimiter()
    const result = limiter.check('a', config)

    expect(result.allowed).toBe(true)
    expect(result.remaining).toBe(2)
    expect(result.resetAt).toBe(1000)
    limiter.dispose()
  })

  test('decrements remaining on each request within the window', () => {
    const limiter = new InMemoryRateLimiter()

    expect(limiter.check('a', config).remaining).toBe(2)
    expect(limiter.check('a', config).remaining).toBe(1)
    expect(limiter.check('a', config).remaining).toBe(0)
    limiter.dispose()
  })

  test('blocks once max requests is reached', () => {
    const limiter = new InMemoryRateLimiter()

    limiter.check('a', config)
    limiter.check('a', config)
    limiter.check('a', config)
    const blocked = limiter.check('a', config)

    expect(blocked.allowed).toBe(false)
    expect(blocked.remaining).toBe(0)
    limiter.dispose()
  })

  test('tracks keys independently', () => {
    const limiter = new InMemoryRateLimiter()

    limiter.check('a', config)
    limiter.check('a', config)
    limiter.check('a', config)

    expect(limiter.check('a', config).allowed).toBe(false)
    expect(limiter.check('b', config).allowed).toBe(true)
    limiter.dispose()
  })

  test('resets after the window expires', () => {
    const limiter = new InMemoryRateLimiter()

    limiter.check('a', config)
    limiter.check('a', config)
    limiter.check('a', config)
    expect(limiter.check('a', config).allowed).toBe(false)

    vi.setSystemTime(1000)
    const afterReset = limiter.check('a', config)

    expect(afterReset.allowed).toBe(true)
    expect(afterReset.remaining).toBe(2)
    expect(afterReset.resetAt).toBe(2000)
    limiter.dispose()
  })
})
