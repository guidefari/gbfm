import type { D1Database } from '@cloudflare/workers-types'
import { DatabaseLayer } from '@/db/layer'
import { createWebHandler } from '@/http/routes'
import { AppLayer } from '@/runtime/services'
import { SitemapCacheLayer, type SitemapKv } from '@/services/sitemap-cache'

const inMemorySitemapKv = (): SitemapKv => {
  const store = new Map<string, string>()
  return {
    get: async (key) => {
      const value = store.get(key)
      return value ? JSON.parse(value) : null
    },
    put: async (key, value) => {
      store.set(key, value)
    }
  }
}

// Mirrors worker.ts's request-scope composition (DatabaseLayer(env.DB),
// SitemapCacheLayer(env.SITEMAP)) with a migrated Miniflare D1 database and
// an in-memory KV stand-in, so HTTP tests exercise the same AppLayer shape
// the Worker builds per request instead of the module-level singleton, which
// intentionally dies outside the Worker request path.
//
// Takes the D1Database instance rather than creating its own so a suite that
// also seeds rows directly (via drizzle's `db` from src/test/database.ts)
// reads and writes the same underlying database as the handler under test.
export const createTestWebHandler = (d1: D1Database) => {
  const appServicesLive = AppLayer(DatabaseLayer(d1), SitemapCacheLayer(inMemorySitemapKv()))
  return createWebHandler({ appServicesLive })
}
