import { Context, Effect, Layer } from 'effect'
import type { MiddlewareHandler } from 'hono'
import { LoggerError } from '@/errors'
import {
  checkPerformanceHealth,
  recordRequest
} from '@/lib/performance-monitoring'
import { config } from '@/services/config.service'

// Performance thresholds for request monitoring
const SLOW_REQUEST_THRESHOLD = 500 // ms - warning
const VERY_SLOW_REQUEST_THRESHOLD = 2000 // ms - error

export interface LoggerService {
  readonly log: (
    message: string,
    level?: 'trace' | 'debug' | 'info' | 'warn' | 'error'
  ) => Effect.Effect<void>
  readonly logRequest: (
    method: string,
    path: string,
    statusCode: number,
    duration: number
  ) => Effect.Effect<void>
}

export const LoggerService = Context.GenericTag<LoggerService>('LoggerService')

export const LoggerServiceLive = Layer.effect(
  LoggerService,
  Effect.gen(function* () {
    return {
      log: (message: string, level = 'info') =>
        Effect.log(`[${level.toUpperCase()}] ${message}`),

      logRequest: (
        method: string,
        path: string,
        statusCode: number,
        duration: number
      ) => Effect.log(`[INFO] ${method} ${path} ${statusCode} - ${duration}ms`)
    }
  })
)

export function effectLogger(): MiddlewareHandler {
  return async (c, next) => {
    const start = Date.now()

    const loggingEffect = Effect.gen(function* () {
      yield* Effect.tryPromise({
        try: () => next(),
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

      // Run all logging effects in parallel
      yield* Effect.all(performanceEffects, { concurrency: 'unbounded' })

      // Handle different logging environments
      if (config.app.nodeEnv === 'production') {
        // Effects already logged above
        return
      } else {
        console.log(
          `[HTTP] ${c.req.method} ${c.req.path} ${c.res.status} - ${duration}ms`
        )
        return
      }
    })

    // Run the entire logging effect
    const { AppRuntime } = await import('@/runtime')
    await AppRuntime.runPromise(
      loggingEffect.pipe(
        Effect.catchAll((error) => {
          const duration = Date.now() - start

          // Fallback logging if Effect logging fails
          if (config.app.nodeEnv === 'production') {
            console.error(
              `[ERROR] ${c.req.method} ${c.req.path} failed - ${duration}ms - ${error._tag}: ${error.message}`
            )
          } else {
            console.error(
              `[HTTP] ${c.req.method} ${c.req.path} failed - ${duration}ms`,
              {
                error: error._tag,
                message: error.message
              }
            )
          }

          // Re-throw the original error if it was a LoggerError, otherwise throw the logging error
          return Effect.fail(
            error instanceof LoggerError
              ? error
              : new LoggerError({
                  message: `Logging failed: ${String(error)}`,
                  operation: 'middleware-logging'
                })
          )
        })
      )
    )
  }
}
