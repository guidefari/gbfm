import * as Effect from 'effect/Effect'
import * as Layer from 'effect/Layer'
import { log } from '@/services/logger'
import { Analytics } from './service'

const logLocalOnly = (method: string) =>
  Effect.sync(() => {
    log('debug', `[analytics:no-op] analytics event captured locally only (${method})`)
  })

export const NoopAnalyticsLayer = Layer.succeed(Analytics, {
  track: () => logLocalOnly('track'),
  identify: () => logLocalOnly('identify'),
  page: () => logLocalOnly('page'),
  reset: logLocalOnly('reset')
})
