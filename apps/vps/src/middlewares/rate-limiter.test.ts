import { Hono } from 'hono'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { InMemoryRateLimiter, getClientKey, rateLimiter } from './rate-limiter'

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

describe('getClientKey', () => {
  async function keyFor(headers: Record<string, string>) {
    const app = new Hono()
    let captured = ''
    app.get('/', (c) => {
      captured = getClientKey(c)
      return c.text('ok')
    })
    await app.request('/', { headers })
    return captured
  }

  test('uses the first ip from x-forwarded-for', async () => {
    expect(await keyFor({ 'x-forwarded-for': '1.1.1.1, 2.2.2.2' })).toBe('1.1.1.1')
  })

  test('trims whitespace around the forwarded ip', async () => {
    expect(await keyFor({ 'x-forwarded-for': '  3.3.3.3  ' })).toBe('3.3.3.3')
  })

  test('falls back to x-real-ip when no forwarded header', async () => {
    expect(await keyFor({ 'x-real-ip': '4.4.4.4' })).toBe('4.4.4.4')
  })

  test('returns unknown when no ip headers are present', async () => {
    expect(await keyFor({})).toBe('unknown')
  })
})

describe('rateLimiter middleware', () => {
  function appWith(maxRequests: number) {
    const app = new Hono()
    app.use('*', rateLimiter({ windowMs: 60_000, maxRequests }))
    app.get('/health', (c) => c.text('ok'))
    app.get('/thing', (c) => c.text('ok'))
    return app
  }

  test('sets rate limit headers on allowed requests', async () => {
    const app = appWith(5)
    const res = await app.request('/thing', {
      headers: { 'x-real-ip': '9.9.9.9' }
    })

    expect(res.status).toBe(200)
    expect(res.headers.get('X-RateLimit-Limit')).toBe('5')
    expect(res.headers.get('X-RateLimit-Remaining')).toBe('4')
    expect(res.headers.get('X-RateLimit-Reset')).not.toBeNull()
  })

  test('returns 429 with Retry-After once the limit is exceeded', async () => {
    const app = appWith(2)
    const headers = { 'x-real-ip': '8.8.8.8' }

    await app.request('/thing', { headers })
    await app.request('/thing', { headers })
    const blocked = await app.request('/thing', { headers })

    expect(blocked.status).toBe(429)
    expect(blocked.headers.get('Retry-After')).not.toBeNull()
  })

  test('does not rate limit excluded health paths', async () => {
    const app = appWith(1)

    await app.request('/health')
    const second = await app.request('/health')

    expect(second.status).toBe(200)
    expect(second.headers.get('X-RateLimit-Limit')).toBeNull()
  })
})
