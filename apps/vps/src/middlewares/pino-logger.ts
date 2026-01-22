import { pinoLogger as logger } from 'hono-pino'
import pino from 'pino'
import pretty from 'pino-pretty'

import { config } from '@/services/config.service'

export function pinoLogger() {
  return logger({
    pino: pino(
      {
        level: config.app.logLevel || 'info'
      },
      config.app.nodeEnv === 'production' ? undefined : pretty()
    )
  })
}
