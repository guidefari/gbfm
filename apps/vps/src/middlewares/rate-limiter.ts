import type { Context, Next } from 'hono'
import { HTTPException } from 'hono/http-exception'

interface RateLimitEntry {
  count: number
  resetAt: number
}

interface RateLimiterConfig {
  windowMs: number
  maxRequests: number
  keyGenerator?: (c: Context) => string
}

const DEFAULT_CONFIG: RateLimiterConfig = {
  windowMs: 60 * 1000,
  maxRequests: 60
}

class InMemoryRateLimiter {
  private store = new Map<string, RateLimitEntry>()
  private cleanupInterval: ReturnType<typeof setInterval>

  constructor() {
    this.cleanupInterval = setInterval(() => this.cleanup(), 60 * 1000)
  }

  check(
    key: string,
    config: RateLimiterConfig
  ): { allowed: boolean; remaining: number; resetAt: number } {
    const now = Date.now()
    const entry = this.store.get(key)

    if (!entry || now >= entry.resetAt) {
      const resetAt = now + config.windowMs
      this.store.set(key, { count: 1, resetAt })
      return { allowed: true, remaining: config.maxRequests - 1, resetAt }
    }

    if (entry.count >= config.maxRequests) {
      return { allowed: false, remaining: 0, resetAt: entry.resetAt }
    }

    entry.count++
    return {
      allowed: true,
      remaining: config.maxRequests - entry.count,
      resetAt: entry.resetAt
    }
  }

  private cleanup() {
    const now = Date.now()
    for (const [key, entry] of this.store.entries()) {
      if (now >= entry.resetAt) {
        this.store.delete(key)
      }
    }
  }

  dispose() {
    clearInterval(this.cleanupInterval)
    this.store.clear()
  }
}

const limiter = new InMemoryRateLimiter()

function getClientKey(c: Context): string {
  const forwarded = c.req.header('x-forwarded-for')
  if (forwarded) {
    const firstIp = forwarded.split(',')[0]
    return firstIp ? firstIp.trim() : 'unknown'
  }
  return c.req.header('x-real-ip') ?? 'unknown'
}

export function rateLimiter(config: Partial<RateLimiterConfig> = {}) {
  const finalConfig = { ...DEFAULT_CONFIG, ...config }

  return async (c: Context, next: Next) => {
    const keyGenerator = finalConfig.keyGenerator ?? getClientKey
    const key = `${c.req.path}:${keyGenerator(c)}`

    const result = limiter.check(key, finalConfig)

    c.header('X-RateLimit-Limit', String(finalConfig.maxRequests))
    c.header('X-RateLimit-Remaining', String(result.remaining))
    c.header('X-RateLimit-Reset', String(Math.ceil(result.resetAt / 1000)))

    if (!result.allowed) {
      const retryAfter = Math.ceil((result.resetAt - Date.now()) / 1000)
      c.header('Retry-After', String(retryAfter))
      throw new HTTPException(429, { message: 'Too many requests' })
    }

    await next()
  }
}

export const strictRateLimiter = () =>
  rateLimiter({
    windowMs: 60 * 1000,
    maxRequests: 10
  })

export const standardRateLimiter = () =>
  rateLimiter({
    windowMs: 60 * 1000,
    maxRequests: 60
  })

export const relaxedRateLimiter = () =>
  rateLimiter({
    windowMs: 60 * 1000,
    maxRequests: 120
  })
