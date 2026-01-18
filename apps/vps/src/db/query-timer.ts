import { Effect } from 'effect'
import pino from 'pino'
import pretty from 'pino-pretty'

import { env } from '@/env'

const logger = pino(
  {
    level: env.LOG_LEVEL || 'info',
    name: 'db-query'
  },
  env.NODE_ENV === 'production' ? undefined : pretty()
)

// Performance thresholds
const SLOW_QUERY_THRESHOLD = 100 // ms
const VERY_SLOW_QUERY_THRESHOLD = 500 // ms

export async function timeQuery<T>(
  queryFn: () => Promise<T>,
  context: string
): Promise<T> {
  const startTime = performance.now()

  try {
    const result = await queryFn()
    const duration = performance.now() - startTime
    const roundedDuration = Math.round(duration * 100) / 100

    // Log slow queries at appropriate levels
    if (duration > VERY_SLOW_QUERY_THRESHOLD) {
      Effect.logError('[Performance] Very slow database query detected', {
        context,
        duration: roundedDuration,
        threshold: VERY_SLOW_QUERY_THRESHOLD,
        severity: 'critical'
      }).pipe(Effect.runPromise)
    } else if (duration > SLOW_QUERY_THRESHOLD) {
      Effect.logWarning('[Performance] Slow database query detected', {
        context,
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

    Effect.logError('[Performance] Database query failed', {
      context,
      duration: Math.round(duration * 100) / 100,
      error: error instanceof Error ? error.message : String(error),
      severity: 'error'
    }).pipe(Effect.runPromise)

    throw error
  }
}
