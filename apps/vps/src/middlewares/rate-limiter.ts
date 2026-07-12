interface RateLimitEntry {
  count: number
  resetAt: number
}

interface RateLimiterConfig {
  windowMs: number
  maxRequests: number
}

export class InMemoryRateLimiter {
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
