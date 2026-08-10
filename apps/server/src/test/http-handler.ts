import type { D1Database } from '@cloudflare/workers-types'
import { Layer } from 'effect'
import { DatabaseLayer } from '@/db/layer'
import { createWebHandler } from '@/http/routes'
import { AppLayer } from '@/runtime/services'
import {
  WorkerSentryEnabledLive,
  WorkerSentryEnv,
  WorkerTracingLive
} from '@/runtime/sentry-worker'
import { NavigationLockLocalLayer } from '@/services/navigation-lock'
import { SentryServiceLayer } from '@/services/sentry.service'
import { SitemapCacheLayer, type SitemapKv } from '@/services/sitemap-cache'

// Tests never call Sentry.withSentry, so Sentry stays disabled (no DSN) and
// the tracing layer falls back to OpenTelemetry's no-op global tracer --
// matching how the Worker behaves in an environment with no SENTRY_DSN set.
// Exported so other test-only AppLayer compositions (e.g.
// health.handlers.failure.test.ts) don't each rebuild this wiring.
export const testSentryServiceLive = SentryServiceLayer.pipe(
  Layer.provide(WorkerSentryEnabledLive),
  Layer.provide(Layer.succeed(WorkerSentryEnv, { dsn: undefined, environment: 'test' }))
)

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
  const appServicesLive = AppLayer(
    DatabaseLayer(d1),
    SitemapCacheLayer(inMemorySitemapKv()),
    NavigationLockLocalLayer,
    testSentryServiceLive,
    WorkerTracingLive
  )
  return createWebHandler({ appServicesLive })
}
