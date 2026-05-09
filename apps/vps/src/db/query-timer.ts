import { Effect } from 'effect'

const SLOW_QUERY_THRESHOLD = 100 // ms
const VERY_SLOW_QUERY_THRESHOLD = 500 // ms

async function runWithAppRuntime(effect: Effect.Effect<void>): Promise<void> {
  const { AppRuntime } = await import('@/runtime')
  await AppRuntime.runPromise(effect)
}

export async function timeQuery<T>(
  queryFn: () => Promise<T>,
  context: string
): Promise<T> {
  const startTime = performance.now()

  try {
    const result = await queryFn()
    const duration = performance.now() - startTime
    const roundedDuration = Math.round(duration * 100) / 100

    if (duration > VERY_SLOW_QUERY_THRESHOLD) {
      await runWithAppRuntime(
        Effect.logError('[Performance] Very slow database query detected', {
          context,
          duration: roundedDuration,
          threshold: VERY_SLOW_QUERY_THRESHOLD,
          severity: 'critical'
        })
      )
    } else if (duration > SLOW_QUERY_THRESHOLD) {
      await runWithAppRuntime(
        Effect.logWarning('[Performance] Slow database query detected', {
          context,
          duration: roundedDuration,
          threshold: SLOW_QUERY_THRESHOLD,
          severity: 'warning'
        })
      )
    } else {
      await runWithAppRuntime(
        Effect.logDebug('[Performance] Database query', {
          context,
          duration: roundedDuration,
          status: 'success'
        })
      )
    }

    return result
  } catch (error) {
    const duration = performance.now() - startTime

    await runWithAppRuntime(
      Effect.logError('[Performance] Database query failed', {
        context,
        duration: Math.round(duration * 100) / 100,
        error: error instanceof Error ? error.message : String(error),
        severity: 'error'
      })
    )

    throw error
  }
}
