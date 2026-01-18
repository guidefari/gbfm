import { Effect } from 'effect'

// Performance monitoring utilities
export interface PerformanceMetrics {
  requestCount: number
  errorCount: number
  averageResponseTime: number
  slowRequests: number
  memoryUsage: NodeJS.MemoryUsage
  uptime: number
}

// Simple in-memory metrics (in production, this would be persisted or sent to monitoring service)
let metrics = {
  requestCount: 0,
  errorCount: 0,
  totalResponseTime: 0,
  slowRequests: 0,
  lastReset: Date.now()
}

const METRICS_RESET_INTERVAL = 300000 // 5 minutes

export function recordRequest(duration: number, isError = false) {
  metrics.requestCount++

  if (isError) {
    metrics.errorCount++
  }

  metrics.totalResponseTime += duration

  if (duration > 500) {
    // Slow request threshold
    metrics.slowRequests++
  }

  // Reset metrics periodically
  if (Date.now() - metrics.lastReset > METRICS_RESET_INTERVAL) {
    Effect.logInfo('[Performance] Metrics summary', {
      period: '5 minutes',
      requests: metrics.requestCount,
      errors: metrics.errorCount,
      slowRequests: metrics.slowRequests
    }).pipe(Effect.runPromise)

    // Reset metrics
    metrics = {
      requestCount: 0,
      errorCount: 0,
      totalResponseTime: 0,
      slowRequests: 0,
      lastReset: Date.now()
    }
  }
}

export function getCurrentMetrics(): PerformanceMetrics {
  const avgResponseTime =
    metrics.requestCount > 0
      ? metrics.totalResponseTime / metrics.requestCount
      : 0

  return {
    requestCount: metrics.requestCount,
    errorCount: metrics.errorCount,
    averageResponseTime: Math.round(avgResponseTime * 100) / 100,
    slowRequests: metrics.slowRequests,
    memoryUsage: process.memoryUsage(),
    uptime: Math.round(process.uptime())
  }
}

export function checkPerformanceHealth(): Effect.Effect<void> {
  return Effect.gen(function* () {
    const currentMetrics = getCurrentMetrics()
    const errorRate =
      currentMetrics.requestCount > 0
        ? (currentMetrics.errorCount / currentMetrics.requestCount) * 100
        : 0

    // Alert on high error rates
    if (errorRate > 10) {
      // More than 10% error rate
      yield* Effect.logError('[Performance] High error rate detected', {
        errorRate: `${errorRate.toFixed(2)}%`,
        totalRequests: currentMetrics.requestCount,
        totalErrors: currentMetrics.errorCount,
        severity: 'critical'
      })
    }

    // Alert on high memory usage
    const heapUsedMB = currentMetrics.memoryUsage.heapUsed / 1024 / 1024
    if (heapUsedMB > 500) {
      // More than 500MB heap usage
      yield* Effect.logWarning('[Performance] High memory usage detected', {
        heapUsed: `${Math.round(heapUsedMB)}MB`,
        uptime: `${currentMetrics.uptime}s`,
        severity: 'warning'
      })
    }
  })
}
