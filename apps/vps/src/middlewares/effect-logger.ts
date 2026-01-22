import { Context, Effect, Layer } from 'effect'
import type { MiddlewareHandler } from 'hono'
import {
  checkPerformanceHealth,
  recordRequest
} from '@/lib/performance-monitoring'
import { config } from '@/services/config.service'

// Performance thresholds for request monitoring
const SLOW_REQUEST_THRESHOLD = 500 // ms - warning
const VERY_SLOW_REQUEST_THRESHOLD = 2000 // ms - error
const MEMORY_CHECK_INTERVAL = 60000 // 1 minute
let lastMemoryCheck = 0

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

    try {
      await next()
      const duration = Date.now() - start

      // Performance monitoring
      if (duration > VERY_SLOW_REQUEST_THRESHOLD) {
        Effect.logError('[Performance] Very slow request detected', {
          method: c.req.method,
          path: c.req.path,
          status: c.res.status,
          duration,
          threshold: VERY_SLOW_REQUEST_THRESHOLD,
          severity: 'critical',
          userAgent: c.req.header('user-agent'),
          ip: c.req.header('x-forwarded-for') || c.req.header('x-real-ip')
        }).pipe(Effect.runPromise)
      } else if (duration > SLOW_REQUEST_THRESHOLD) {
        Effect.logWarning('[Performance] Slow request detected', {
          method: c.req.method,
          path: c.req.path,
          status: c.res.status,
          duration,
          threshold: SLOW_REQUEST_THRESHOLD,
          severity: 'warning'
        }).pipe(Effect.runPromise)
      }

      // Periodic memory usage monitoring
      const now = Date.now()
      if (now - lastMemoryCheck > MEMORY_CHECK_INTERVAL) {
        const memUsage = process.memoryUsage()
        Effect.logInfo('[Performance] Memory usage check', {
          rssMB: Math.round(memUsage.rss / 1024 / 1024),
          heapUsedMB: Math.round(memUsage.heapUsed / 1024 / 1024),
          heapTotalMB: Math.round(memUsage.heapTotal / 1024 / 1024),
          externalMB: Math.round(memUsage.external / 1024 / 1024),
          totalMB: Math.round(memUsage.rss / 1024 / 1024),
          uptimeSeconds: Math.round(process.uptime())
        }).pipe(Effect.runPromise)
        lastMemoryCheck = now
      }

      // Record request metrics
      recordRequest(duration, c.res.status >= 400)

      // Periodic health checks
      checkPerformanceHealth().pipe(Effect.runPromise)

      // Standard request logging
      const logEffect = Effect.log(
        `[INFO] ${c.req.method} ${c.req.path} ${c.res.status} - ${duration}ms`
      )

      if (config.app.nodeEnv === 'production') {
        await Effect.runPromise(logEffect)
      } else {
        Effect.logInfo(
          `[HTTP] ${c.req.method} ${c.req.path} ${c.res.status} - ${duration}ms`
        )
      }
    } catch (error) {
      const duration = Date.now() - start

      Effect.logError('[Performance] Request failed', {
        method: c.req.method,
        path: c.req.path,
        duration,
        error: error instanceof Error ? error.message : String(error),
        severity: 'error'
      }).pipe(Effect.runPromise)

      const logEffect = Effect.logError(
        `[ERROR] ${c.req.method} ${c.req.path} - ${duration}ms - ${error}`
      )

      if (config.app.nodeEnv === 'production') {
        await Effect.runPromise(logEffect)
      } else {
        Effect.logError(
          `[HTTP] ${c.req.method} ${c.req.path} failed - ${duration}ms`,
          {
            error: error instanceof Error ? error.message : String(error)
          }
        )
      }

      throw error
    }
  }
}
