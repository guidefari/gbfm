import { Effect } from 'effect'
import {
  HttpMiddleware,
  HttpRouter,
  HttpServerRequest,
  HttpServerResponse
} from 'effect/unstable/http'
import { InMemoryRateLimiter } from '@/middlewares/rate-limiter'
import { checkPerformanceHealth, recordRequest } from '@/lib/performance-monitoring'
import { config } from '@/services/config.service'
import { SentryService } from '@/services/sentry.service'

// Step 8 (docs/migration-effect-http-api.md): the four global concerns that
// used to be Hono middleware in apps/vps/src/lib/create-app.ts, ported to
// Effect's global HttpRouter.middleware -- global (not endpoint-scoped)
// because CORS/rate-limiting/logging/defect-reporting need to cover every
// route including better-auth and the plain HttpRouter routes in
// site-routes.ts, not just HttpApiBuilder endpoints.

// ── CORS ──────────────────────────────────────────────────────
// Matches apps/vps/src/lib/create-app.ts's corsConfig exactly. The old Hono
// origin() function never actually rejects -- it falls back to the
// production origin for any unrecognized Origin header rather than omitting
// the CORS headers -- so this uses the predicate form of allowedOrigins
// (not a fixed array) to reproduce that exact fallback behavior rather than
// Effect's own array-mode "omit the header for unknown origins" semantics.
const ALLOWED_ORIGINS = [
  'http://127.0.0.1:5173',
  'http://localhost:4173',
  'http://127.0.0.1:3003',
  'https://www.goosebumps.fm',
  'https://goosebumps.fm'
]

const isAllowedOrigin = (origin: string) =>
  ALLOWED_ORIGINS.includes(origin) || origin === config.urls.frontend

export const CorsLive = HttpRouter.middleware(
  HttpMiddleware.cors({
    allowedOrigins: isAllowedOrigin,
    allowedMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'Cookie',
      'Refresh-Token',
      'sentry-trace',
      'baggage'
    ],
    exposedHeaders: ['Set-Cookie'],
    credentials: true
  }),
  { global: true }
)

// ── Rate limiting ─────────────────────────────────────────────
// InMemoryRateLimiter (apps/vps/src/middlewares/rate-limiter.ts) is already
// transport-agnostic. Only standardRateLimiter (60 req/min, applied
// globally by the old create-app.ts) is still live -- strictRateLimiter/
// relaxedRateLimiter/playTrackRateLimiter were per-route factories used by
// Hono route groups that have all been migrated off Hono already (steps
// 4-7), confirmed dead by grep (zero remaining call sites), so they are not
// ported here.
const limiter = new InMemoryRateLimiter()
const RATE_LIMIT_EXCLUDED_PATHS = new Set(['/health', '/health/live', '/health/ready'])
const RATE_LIMIT_CONFIG = { windowMs: 60_000, maxRequests: 60 }

const rateLimitClientKey = (headers: Readonly<Record<string, string | undefined>>) => {
  const forwarded = headers['x-forwarded-for']
  if (forwarded) return forwarded.split(',')[0]?.trim() || 'unknown'
  return headers['x-real-ip'] ?? 'unknown'
}

export const RateLimiterLive = HttpRouter.middleware(
  (httpEffect) =>
    Effect.gen(function* () {
      const request = yield* HttpServerRequest.HttpServerRequest
      const path = new URL(request.url, 'http://localhost').pathname
      if (RATE_LIMIT_EXCLUDED_PATHS.has(path)) return yield* httpEffect

      const key = `${path}:${rateLimitClientKey(request.headers)}`
      const result = limiter.check(key, RATE_LIMIT_CONFIG)

      const headers = {
        'x-ratelimit-limit': String(RATE_LIMIT_CONFIG.maxRequests),
        'x-ratelimit-remaining': String(result.remaining),
        'x-ratelimit-reset': String(Math.ceil(result.resetAt / 1000))
      }

      if (!result.allowed) {
        const retryAfter = Math.ceil((result.resetAt - Date.now()) / 1000)
        return HttpServerResponse.text('Too many requests', {
          status: 429,
          headers: { ...headers, 'retry-after': String(retryAfter) }
        })
      }

      const response = yield* httpEffect
      return HttpServerResponse.setHeaders(response, headers)
    }),
  { global: true }
)

// ── Performance metrics + slow-request warnings ──────────────────
// Basic per-request "method/url/status" logging is NOT ported here --
// HttpRouter.toWebHandler already applies HttpMiddleware.logger by default
// (disableLogger defaults to false/unset), confirmed against HttpRouter.ts:
// every request already logs "Sent HTTP response" with http.method/
// http.url/http.status annotations for free, matching what the old
// effectLogger()'s plain `Effect.log(...)` line duplicated. Only the parts
// with no free equivalent are ported: slow-request warnings and the
// recordRequest/checkPerformanceHealth Effect Metrics
// (apps/vps/src/lib/performance-monitoring.ts, already framework-agnostic,
// reused unchanged). HttpMiddleware.tracer (OpenTelemetry span-per-request)
// is intentionally not added here either -- it wasn't free, and the
// migration doc flags the old effectLogger()'s span behavior as possibly
// redundant with what toWebHandler's own tracing already does; left as a
// separate follow-up decision rather than folded into this middleware move.
const SLOW_REQUEST_THRESHOLD = 500
const VERY_SLOW_REQUEST_THRESHOLD = 2000

export const RequestLoggerLive = HttpRouter.middleware(
  (httpEffect) =>
    Effect.gen(function* () {
      const request = yield* HttpServerRequest.HttpServerRequest
      const start = Date.now()
      const response = yield* httpEffect
      const duration = Date.now() - start

      if (duration > VERY_SLOW_REQUEST_THRESHOLD) {
        yield* Effect.logError('[Performance] Very slow request detected', {
          method: request.method,
          path: request.url,
          status: response.status,
          duration,
          threshold: VERY_SLOW_REQUEST_THRESHOLD,
          severity: 'critical'
        })
      } else if (duration > SLOW_REQUEST_THRESHOLD) {
        yield* Effect.logWarning('[Performance] Slow request detected', {
          method: request.method,
          path: request.url,
          status: response.status,
          duration,
          threshold: SLOW_REQUEST_THRESHOLD,
          severity: 'warning'
        })
      }

      yield* recordRequest(duration, response.status >= 400)
      yield* checkPerformanceHealth

      return response
    }),
  { global: true }
)

// ── Defect → Sentry capture ──────────────────────────────────────
// The old Hono app.onError (create-app.ts) was the only place that reported
// uncaught errors to Sentry for anything reachable through the Hono app --
// but per docs/migration-effect-http-api-process.md's step-8 findings, no
// equivalent has ever existed on the Effect side: HttpApiBuilder's
// Effect.withErrorReporting feeds Effect's own ErrorReporter mechanism,
// which this app never registers a reporter for, so it silently no-ops.
// Effect.tapDefect here is the actual fix -- it runs on every global
// middleware-wrapped route (HttpApiBuilder endpoints AND plain HttpRouter
// routes like site-routes.ts/betterAuthRoute), closing a real gap that
// predates this specific PR.
export const SentryDefectLive = HttpRouter.middleware(
  (httpEffect) =>
    httpEffect.pipe(
      Effect.tapDefect((defect) =>
        Effect.gen(function* () {
          const sentry = yield* SentryService
          yield* sentry.captureException(defect)
        })
      )
    ),
  { global: true }
)
