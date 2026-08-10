import { Cause, Effect, Exit, Layer } from 'effect'
import { HttpMiddleware, HttpRouter, HttpServerRequest } from 'effect/unstable/http'
import { checkPerformanceHealth, recordRequest } from '@/lib/performance-monitoring'
import { ConfigService } from '@/services/config.service'
import { SentryService } from '@/services/sentry.service'

// Step 8 (docs/migration-effect-http-api.md): the global concerns that used
// to be Hono middleware in apps/server/src/lib/create-app.ts, ported to
// Effect's global HttpRouter.middleware -- global (not endpoint-scoped)
// because CORS/logging/defect-reporting need to cover every route including
// better-auth and the plain HttpRouter routes in site-routes.ts, not just
// HttpApiBuilder endpoints. Rate limiting (OPS-248) was dropped from this
// list: it moved to Cloudflare's edge Rate Limiting rules, see
// docs/migrations/postgres-to-d1.md's "Rate limiting" subsection.

// ── CORS ──────────────────────────────────────────────────────
// Matches apps/server/src/lib/create-app.ts's corsConfig exactly. The old Hono
// origin() function never actually rejects -- it falls back to the
// production origin for any unrecognized Origin header rather than omitting
// the CORS headers -- so this uses the predicate form of allowedOrigins
// (not a fixed array) to reproduce that exact fallback behavior rather than
// Effect's own array-mode "omit the header for unknown origins" semantics.
const ALLOWED_ORIGINS = [
  'http://127.0.0.1:5173',
  'http://localhost:4173',
  'http://127.0.0.1:3003',
  'https://gbfm.localhost',
  'https://gbfm.test',
  'https://www.goosebumps.fm',
  'https://goosebumps.fm'
]

export const CorsLive = Layer.unwrap(
  Effect.gen(function* () {
    const config = yield* ConfigService
    return HttpRouter.middleware(
      HttpMiddleware.cors({
        allowedOrigins: (origin) =>
          ALLOWED_ORIGINS.includes(origin) || origin === config.urls.frontend,
        allowedMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
        allowedHeaders: [
          'Content-Type',
          'Authorization',
          'Cookie',
          'Refresh-Token',
          'sentry-trace',
          'baggage',
          'b3',
          'traceparent'
        ],
        exposedHeaders: ['Set-Cookie'],
        credentials: true
      }),
      { global: true }
    )
  })
)

export const requestPath = (url: string) => new URL(url, 'http://localhost').pathname

// ── Performance metrics + slow-request warnings ──────────────────
// Request events are emitted here so the application has one structured
// request-log producer. HttpRouter's built-in logger is disabled in routes.ts
// to avoid a second response line. Slow-request warnings and the
// recordRequest/checkPerformanceHealth Effect Metrics remain separate events.
const SLOW_REQUEST_THRESHOLD = 500
const VERY_SLOW_REQUEST_THRESHOLD = 2000

export const RequestLoggerLive = HttpRouter.middleware(
  (httpEffect) =>
    Effect.gen(function* () {
      const request = yield* HttpServerRequest.HttpServerRequest
      const path = requestPath(request.url)
      const start = Date.now()
      const result = yield* Effect.exit(httpEffect)
      const duration = Date.now() - start

      if (Exit.isFailure(result)) {
        const clientAborted = Cause.hasInterruptsOnly(result.cause)
        yield* clientAborted
          ? Effect.logInfo('[HTTP] client aborted request', {
              method: request.method,
              path,
              status: 499,
              duration,
              outcome: 'client_abort'
            })
          : Effect.logError('[HTTP] request failed', {
              method: request.method,
              path,
              duration,
              cause: result.cause
            })
        if (clientAborted) yield* recordRequest(duration, false)
        return yield* Effect.failCause(result.cause)
      }

      const response = result.value
      yield* Effect.logInfo('[HTTP] request completed', {
        method: request.method,
        path,
        status: response.status,
        duration
      })

      if (duration > VERY_SLOW_REQUEST_THRESHOLD) {
        yield* Effect.logError('[Performance] Very slow request detected', {
          method: request.method,
          path,
          status: response.status,
          duration,
          threshold: VERY_SLOW_REQUEST_THRESHOLD,
          severity: 'critical'
        })
      } else if (duration > SLOW_REQUEST_THRESHOLD) {
        yield* Effect.logWarning('[Performance] Slow request detected', {
          method: request.method,
          path,
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
