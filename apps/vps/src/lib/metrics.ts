import { Effect, Metric, MetricBoundaries } from 'effect'

// ============================================================================
// Request Metrics
// ============================================================================

export const requestCounter = Metric.counter('http_requests_total', {
  description: 'Total number of HTTP requests'
}).pipe(Metric.tagged('service', 'goosebumps-fm-api'))

export const requestDuration = Metric.histogram(
  'http_request_duration_ms',
  MetricBoundaries.exponential({
    start: 1,
    factor: 2,
    count: 15 // 1, 2, 4, 8, 16, 32, 64, 128, 256, 512, 1024, 2048, 4096, 8192, 16384
  }),
  'HTTP request duration in milliseconds'
)

export const requestErrors = Metric.counter('http_request_errors_total', {
  description: 'Total number of HTTP request errors'
})

export const slowRequests = Metric.counter('http_slow_requests_total', {
  description: 'Total number of slow requests (>500ms)'
})

// ============================================================================
// Database Metrics
// ============================================================================

export const dbQueryCounter = Metric.counter('db_queries_total', {
  description: 'Total number of database queries'
})

export const dbQueryDuration = Metric.histogram(
  'db_query_duration_ms',
  MetricBoundaries.exponential({
    start: 1,
    factor: 2,
    count: 12 // 1ms to 4096ms
  }),
  'Database query duration in milliseconds'
)

export const dbQueryErrors = Metric.counter('db_query_errors_total', {
  description: 'Total number of database query errors'
})

export const dbSlowQueries = Metric.counter('db_slow_queries_total', {
  description: 'Total number of slow queries (>100ms)'
})

// ============================================================================
// Service Operation Metrics
// ============================================================================

export const serviceOperationCounter = Metric.counter(
  'service_operations_total',
  {
    description: 'Total number of service operations'
  }
)

export const serviceOperationDuration = Metric.histogram(
  'service_operation_duration_ms',
  MetricBoundaries.exponential({
    start: 1,
    factor: 2,
    count: 14 // 1ms to 8192ms
  }),
  'Service operation duration in milliseconds'
)

export const serviceOperationErrors = Metric.counter(
  'service_operation_errors_total',
  {
    description: 'Total number of service operation errors'
  }
)

// ============================================================================
// External API Metrics (Spotify, Bandcamp)
// ============================================================================

export const externalApiCalls = Metric.counter('external_api_calls_total', {
  description: 'Total number of external API calls'
})

export const externalApiDuration = Metric.histogram(
  'external_api_duration_ms',
  MetricBoundaries.exponential({
    start: 10,
    factor: 2,
    count: 10 // 10ms to 10240ms
  }),
  'External API call duration in milliseconds'
)

export const externalApiErrors = Metric.counter('external_api_errors_total', {
  description: 'Total number of external API errors'
})

// Cache metrics for Bandcamp
export const cacheHits = Metric.counter('cache_hits_total', {
  description: 'Total number of cache hits'
})

export const cacheMisses = Metric.counter('cache_misses_total', {
  description: 'Total number of cache misses'
})

export const cacheSize = Metric.gauge('cache_size', {
  description: 'Current cache size (number of entries)'
})

// ============================================================================
// Background Job Metrics (Reminder Processor)
// ============================================================================

export const jobRunCounter = Metric.counter('job_runs_total', {
  description: 'Total number of background job runs'
})

export const jobDuration = Metric.histogram(
  'job_duration_ms',
  MetricBoundaries.exponential({
    start: 10,
    factor: 2,
    count: 12 // 10ms to 40960ms
  }),
  'Background job duration in milliseconds'
)

export const jobItemsProcessed = Metric.counter('job_items_processed_total', {
  description: 'Total number of items processed by background jobs'
})

export const jobItemsFailed = Metric.counter('job_items_failed_total', {
  description: 'Total number of items that failed processing'
})

export const jobQueueDepth = Metric.gauge('job_queue_depth', {
  description: 'Current number of pending items in job queue'
})

// ============================================================================
// Email Metrics
// ============================================================================

export const emailsSent = Metric.counter('emails_sent_total', {
  description: 'Total number of emails sent'
})

export const emailsFailed = Metric.counter('emails_failed_total', {
  description: 'Total number of failed email sends'
})

export const emailDuration = Metric.histogram(
  'email_send_duration_ms',
  MetricBoundaries.exponential({
    start: 50,
    factor: 2,
    count: 8 // 50ms to 12800ms
  }),
  'Email send duration in milliseconds'
)

// ============================================================================
// System Health Gauges
// ============================================================================

export const heapUsedMb = Metric.gauge('heap_used_mb', {
  description: 'Current heap memory usage in MB'
})

export const heapTotalMb = Metric.gauge('heap_total_mb', {
  description: 'Total heap memory available in MB'
})

export const uptimeSeconds = Metric.gauge('uptime_seconds', {
  description: 'Process uptime in seconds'
})

export const activeHandles = Metric.gauge('active_handles', {
  description: 'Number of active handles in Node.js event loop'
})

export const eventLoopLagMs = Metric.gauge('event_loop_lag_ms', {
  description: 'Event loop lag in milliseconds'
})

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Record HTTP request metrics
 */
export const recordHttpRequest = (
  method: string,
  path: string,
  status: number,
  durationMs: number
) =>
  Effect.gen(function* () {
    const normalizedPath = normalizePath(path)
    const isError = status >= 400

    yield* requestCounter.pipe(
      Metric.tagged('method', method),
      Metric.tagged('path', normalizedPath),
      Metric.tagged('status', String(status)),
      (m) => m(Effect.succeed(1))
    )

    yield* requestDuration.pipe(
      Metric.tagged('method', method),
      Metric.tagged('path', normalizedPath),
      (m) => m(Effect.succeed(durationMs))
    )

    if (isError) {
      yield* requestErrors.pipe(
        Metric.tagged('method', method),
        Metric.tagged('path', normalizedPath),
        Metric.tagged('status', String(status)),
        (m) => m(Effect.succeed(1))
      )
    }

    if (durationMs > 500) {
      yield* slowRequests.pipe(
        Metric.tagged('method', method),
        Metric.tagged('path', normalizedPath),
        (m) => m(Effect.succeed(1))
      )
    }
  })

/**
 * Record database query metrics
 */
export const recordDbQuery = (
  table: string,
  operation: 'select' | 'insert' | 'update' | 'delete',
  durationMs: number,
  isError = false
) =>
  Effect.gen(function* () {
    yield* dbQueryCounter.pipe(
      Metric.tagged('table', table),
      Metric.tagged('operation', operation),
      (m) => m(Effect.succeed(1))
    )

    yield* dbQueryDuration.pipe(
      Metric.tagged('table', table),
      Metric.tagged('operation', operation),
      (m) => m(Effect.succeed(durationMs))
    )

    if (isError) {
      yield* dbQueryErrors.pipe(
        Metric.tagged('table', table),
        Metric.tagged('operation', operation),
        (m) => m(Effect.succeed(1))
      )
    }

    if (durationMs > 100) {
      yield* dbSlowQueries.pipe(
        Metric.tagged('table', table),
        Metric.tagged('operation', operation),
        (m) => m(Effect.succeed(1))
      )
    }
  })

/**
 * Record service operation metrics
 */
export const recordServiceOperation = (
  service: string,
  operation: string,
  durationMs: number,
  isError = false
) =>
  Effect.gen(function* () {
    yield* serviceOperationCounter.pipe(
      Metric.tagged('service', service),
      Metric.tagged('operation', operation),
      Metric.tagged('status', isError ? 'error' : 'success'),
      (m) => m(Effect.succeed(1))
    )

    yield* serviceOperationDuration.pipe(
      Metric.tagged('service', service),
      Metric.tagged('operation', operation),
      (m) => m(Effect.succeed(durationMs))
    )

    if (isError) {
      yield* serviceOperationErrors.pipe(
        Metric.tagged('service', service),
        Metric.tagged('operation', operation),
        (m) => m(Effect.succeed(1))
      )
    }
  })

/**
 * Record external API call metrics
 */
export const recordExternalApiCall = (
  api: string,
  endpoint: string,
  durationMs: number,
  isError = false
) =>
  Effect.gen(function* () {
    yield* externalApiCalls.pipe(
      Metric.tagged('api', api),
      Metric.tagged('endpoint', endpoint),
      Metric.tagged('status', isError ? 'error' : 'success'),
      (m) => m(Effect.succeed(1))
    )

    yield* externalApiDuration.pipe(
      Metric.tagged('api', api),
      Metric.tagged('endpoint', endpoint),
      (m) => m(Effect.succeed(durationMs))
    )

    if (isError) {
      yield* externalApiErrors.pipe(
        Metric.tagged('api', api),
        Metric.tagged('endpoint', endpoint),
        (m) => m(Effect.succeed(1))
      )
    }
  })

/**
 * Record cache hit/miss
 */
export const recordCacheAccess = (
  cacheName: string,
  isHit: boolean,
  currentSize?: number
) =>
  Effect.gen(function* () {
    if (isHit) {
      yield* cacheHits.pipe(Metric.tagged('cache', cacheName), (m) =>
        m(Effect.succeed(1))
      )
    } else {
      yield* cacheMisses.pipe(Metric.tagged('cache', cacheName), (m) =>
        m(Effect.succeed(1))
      )
    }

    if (currentSize !== undefined) {
      yield* cacheSize.pipe(Metric.tagged('cache', cacheName), (m) =>
        m(Effect.succeed(currentSize))
      )
    }
  })

/**
 * Record background job execution
 */
export const recordJobExecution = (
  jobName: string,
  durationMs: number,
  processedCount: number,
  failedCount: number,
  queueDepth?: number
) =>
  Effect.gen(function* () {
    yield* jobRunCounter.pipe(Metric.tagged('job', jobName), (m) =>
      m(Effect.succeed(1))
    )

    yield* jobDuration.pipe(Metric.tagged('job', jobName), (m) =>
      m(Effect.succeed(durationMs))
    )

    if (processedCount > 0) {
      yield* jobItemsProcessed.pipe(Metric.tagged('job', jobName), (m) =>
        m(Effect.succeed(processedCount))
      )
    }

    if (failedCount > 0) {
      yield* jobItemsFailed.pipe(Metric.tagged('job', jobName), (m) =>
        m(Effect.succeed(failedCount))
      )
    }

    if (queueDepth !== undefined) {
      yield* jobQueueDepth.pipe(Metric.tagged('job', jobName), (m) =>
        m(Effect.succeed(queueDepth))
      )
    }
  })

/**
 * Record email send metrics
 */
export const recordEmailSend = (
  template: string,
  durationMs: number,
  isError = false
) =>
  Effect.gen(function* () {
    if (isError) {
      yield* emailsFailed.pipe(Metric.tagged('template', template), (m) =>
        m(Effect.succeed(1))
      )
    } else {
      yield* emailsSent.pipe(Metric.tagged('template', template), (m) =>
        m(Effect.succeed(1))
      )
    }

    yield* emailDuration.pipe(Metric.tagged('template', template), (m) =>
      m(Effect.succeed(durationMs))
    )
  })

/**
 * Record system health metrics
 */
export const recordSystemHealth = Effect.gen(function* () {
  const memUsage = process.memoryUsage()
  const heapUsed = memUsage.heapUsed / 1024 / 1024
  const heapTotal = memUsage.heapTotal / 1024 / 1024
  const uptime = process.uptime()

  yield* heapUsedMb(Effect.succeed(heapUsed))
  yield* heapTotalMb(Effect.succeed(heapTotal))
  yield* uptimeSeconds(Effect.succeed(uptime))

  // Event loop lag measurement
  const lagStart = performance.now()
  yield* Effect.sleep('1 millis')
  const lagMs = performance.now() - lagStart - 1
  yield* eventLoopLagMs(Effect.succeed(Math.max(0, lagMs)))

  // Active handles - this is platform specific
  if (typeof (process as any)._getActiveHandles === 'function') {
    const handles = (process as any)._getActiveHandles().length
    yield* activeHandles(Effect.succeed(handles))
  }

  // Log warning if memory is high
  if (heapUsed > 500) {
    yield* Effect.logWarning('[Metrics] High memory usage', {
      heapUsedMb: Math.round(heapUsed),
      heapTotalMb: Math.round(heapTotal),
      heapUtilization: `${Math.round((heapUsed / heapTotal) * 100)}%`
    })
  }
})

// ============================================================================
// Path Normalization
// ============================================================================

/**
 * Normalize request paths to group dynamic segments
 * e.g., /audio/abc123 -> /audio/:id
 */
function normalizePath(path: string): string {
  // UUID pattern
  const uuidPattern =
    /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi
  // Slug pattern (alphanumeric with hyphens, 3+ chars)
  const slugPattern = /(?<=\/)[a-z0-9-]{3,}(?=\/|$)/gi

  let normalized = path
    .replace(uuidPattern, ':id')
    .replace(/\/\d+(?=\/|$)/g, '/:id')

  // Only replace slugs in known routes
  const slugRoutes = ['/audio/', '/shows/', '/publications/', '/releases/']
  for (const route of slugRoutes) {
    if (normalized.startsWith(route) && !normalized.includes(':id')) {
      const segments = normalized.split('/')
      if (segments.length >= 3 && segments[2]) {
        segments[2] = ':slug'
        normalized = segments.join('/')
      }
    }
  }

  return normalized
}
