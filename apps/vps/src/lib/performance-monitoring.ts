import { Effect, Metric } from 'effect'

const requestCount = Metric.counter("request_count", {
  description: "Total number of requests"
})

const errorCount = Metric.counter("error_count", {
  description: "Total number of errors"
})

const slowRequestCount = Metric.counter("slow_request_count", {
  description: "Total number of slow requests (>500ms)"
})

const responseTime = Metric.gauge("response_time_ms", {
  description: "Most recent response time in milliseconds"
})

const heapUsed = Metric.gauge("heap_used_mb", {
  description: "Current heap memory usage in MB"
})

const uptime = Metric.gauge("uptime_seconds", {
  description: "Process uptime in seconds"
})

const SLOW_REQUEST_THRESHOLD = 500

export const recordRequest = (duration: number, isError = false) =>
  Effect.gen(function* () {
    yield* requestCount(Effect.succeed(1))
    yield* responseTime(Effect.succeed(duration))

    if (isError) {
      yield* errorCount(Effect.succeed(1))
    }

    if (duration > SLOW_REQUEST_THRESHOLD) {
      yield* slowRequestCount(Effect.succeed(1))
    }
  })

export const checkPerformanceHealth = Effect.gen(function* () {
  const heapUsedMB = process.memoryUsage().heapUsed / 1024 / 1024
  yield* heapUsed(Effect.succeed(heapUsedMB))
  yield* uptime(Effect.succeed(process.uptime()))

  if (heapUsedMB > 500) {
    yield* Effect.logWarning('[Performance] High memory usage detected', {
      heapUsed: `${Math.round(heapUsedMB)}MB`,
      uptime: `${Math.round(process.uptime())}s`
    })
  }
})
