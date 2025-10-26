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

export async function timeQuery<T>(
  queryFn: () => Promise<T>,
  context: string
): Promise<T> {
  const startTime = performance.now()

  try {
    const result = await queryFn()
    const duration = performance.now() - startTime

    logger.debug({
      context,
      duration: Math.round(duration * 100) / 100,
      status: 'success'
    })

    return result
  } catch (error) {
    const duration = performance.now() - startTime

    logger.error({
      context,
      duration: Math.round(duration * 100) / 100,
      status: 'error',
      error: error instanceof Error ? error.message : String(error)
    })

    throw error
  }
}
