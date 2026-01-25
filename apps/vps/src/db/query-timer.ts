import { Effect } from 'effect'
import pino from 'pino'
import pretty from 'pino-pretty'

import { recordDbQuery } from '@/lib/metrics'
import { config } from '@/services/config.service'

const logger = pino(
  {
    level: config.app.logLevel || 'info',
    name: 'db-query'
  },
  config.app.nodeEnv === 'production' ? undefined : pretty()
)

// Performance thresholds
const SLOW_QUERY_THRESHOLD = 100 // ms
const VERY_SLOW_QUERY_THRESHOLD = 500 // ms

/**
 * Time a database query and record metrics.
 * @param queryFn The query function to execute
 * @param context Context string in format "table.operation" (e.g., "audio.select", "users.insert")
 */
export async function timeQuery<T>(
  queryFn: () => Promise<T>,
  context: string
): Promise<T> {
  const startTime = performance.now()

  // Parse context to extract table and operation
  const [table, operation] = context.split('.') as [
    string,
    'select' | 'insert' | 'update' | 'delete'
  ]

  try {
    const result = await queryFn()
    const duration = performance.now() - startTime
    const roundedDuration = Math.round(duration * 100) / 100

    // Record metrics
    recordDbQuery(
      table || 'unknown',
      operation || 'select',
      roundedDuration,
      false
    ).pipe(Effect.runPromise)

    // Log slow queries at appropriate levels
    if (duration > VERY_SLOW_QUERY_THRESHOLD) {
      Effect.logError('[Performance] Very slow database query detected', {
        context,
        table,
        operation,
        duration: roundedDuration,
        threshold: VERY_SLOW_QUERY_THRESHOLD,
        severity: 'critical'
      }).pipe(Effect.runPromise)
    } else if (duration > SLOW_QUERY_THRESHOLD) {
      Effect.logWarning('[Performance] Slow database query detected', {
        context,
        table,
        operation,
        duration: roundedDuration,
        threshold: SLOW_QUERY_THRESHOLD,
        severity: 'warning'
      }).pipe(Effect.runPromise)
    } else {
      // Normal queries still logged at debug level
      logger.debug({
        context,
        duration: roundedDuration,
        status: 'success'
      })
    }

    return result
  } catch (error) {
    const duration = performance.now() - startTime
    const roundedDuration = Math.round(duration * 100) / 100

    // Record error metrics
    recordDbQuery(
      table || 'unknown',
      operation || 'select',
      roundedDuration,
      true
    ).pipe(Effect.runPromise)

    Effect.logError('[Performance] Database query failed', {
      context,
      table,
      operation,
      duration: roundedDuration,
      error: error instanceof Error ? error.message : String(error),
      severity: 'error'
    }).pipe(Effect.runPromise)

    throw error
  }
}
