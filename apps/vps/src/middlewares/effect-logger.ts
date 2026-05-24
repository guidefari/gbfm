import { SpanStatusCode, trace } from '@opentelemetry/api'
import { Effect } from 'effect'
import type { MiddlewareHandler } from 'hono'
import { LoggerError } from '@/errors'
import {
  checkPerformanceHealth,
  recordRequest
} from '@/lib/performance-monitoring'

const SLOW_REQUEST_THRESHOLD = 500
const VERY_SLOW_REQUEST_THRESHOLD = 2000

export function effectLogger(): MiddlewareHandler {
  return async (c, next) => {
    const start = Date.now()
    const tracer = trace.getTracer('gbfm.vps')
    const spanName = `${c.req.method} ${c.req.path}`

    const loggingEffect = Effect.gen(function* () {
      yield* Effect.tryPromise({
        try: () =>
          tracer.startActiveSpan(spanName, async (span) => {
            try {
              await next()
            } catch (error) {
              span.recordException(
                error instanceof Error ? error : new Error(String(error))
              )
              span.setStatus({
                code: SpanStatusCode.ERROR,
                message: error instanceof Error ? error.message : String(error)
              })
              throw error
            } finally {
              span.setAttribute('http.method', c.req.method)
              span.setAttribute('http.route', c.req.path)
              span.setAttribute('http.status_code', c.res.status)
              span.setAttribute('http.duration_ms', Date.now() - start)
              span.end()
            }
          }),
        catch: (error) =>
          error instanceof Error
            ? new LoggerError({
                message: `Request failed: ${error.message}`,
                operation: 'middleware-next'
              })
            : new LoggerError({
                message: `Request failed: Unknown error: ${String(error)}`,
                operation: 'middleware-next'
              })
      })

      const duration = Date.now() - start

      // Performance monitoring effects
      const performanceEffects = [
        duration > VERY_SLOW_REQUEST_THRESHOLD
          ? Effect.logError('[Performance] Very slow request detected', {
              method: c.req.method,
              path: c.req.path,
              status: c.res.status,
              duration,
              threshold: VERY_SLOW_REQUEST_THRESHOLD,
              severity: 'critical',
              userAgent: c.req.header('user-agent'),
              ip: c.req.header('x-forwarded-for') || c.req.header('x-real-ip')
            })
          : duration > SLOW_REQUEST_THRESHOLD
            ? Effect.logWarning('[Performance] Slow request detected', {
                method: c.req.method,
                path: c.req.path,
                status: c.res.status,
                duration,
                threshold: SLOW_REQUEST_THRESHOLD,
                severity: 'warning'
              })
            : Effect.void,

        recordRequest(duration, c.res.status >= 400),
        checkPerformanceHealth,

        // Standard request logging
        Effect.log(
          `[INFO] ${c.req.method} ${c.req.path} ${c.res.status} - ${duration}ms`
        )
      ]

      yield* Effect.all(performanceEffects, { concurrency: 'unbounded' })
    })

    // Run the entire logging effect
    const { AppRuntime } = await import('@/runtime')
    await AppRuntime.runPromise(
      loggingEffect.pipe(
        Effect.catch((error) =>
          Effect.logError('Request failed', {
            method: c.req.method,
            path: c.req.path,
            duration: Date.now() - start,
            error: error._tag,
            message: error.message
          }).pipe(
            Effect.andThen(
              Effect.fail(
                error instanceof LoggerError
                  ? error
                  : new LoggerError({
                      message: `Logging failed: ${String(error)}`,
                      operation: 'middleware-logging'
                    })
              )
            )
          )
        )
      )
    )
  }
}
