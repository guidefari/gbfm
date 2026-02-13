import { Effect, Layer } from 'effect'
import { Analytics } from './service'

const logLocalOnly = (method: string) =>
  Effect.sync(() => {
    console.info(
      `[analytics:no-op] analytics event captured locally only (${method})`
    )
  })

export const NoopAnalyticsLayer = Layer.succeed(
  Analytics,
  Analytics.of({
    track: () => logLocalOnly('track'),
    identify: () => logLocalOnly('identify'),
    page: () => logLocalOnly('page'),
    reset: () => logLocalOnly('reset')
  })
)
