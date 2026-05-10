import * as Effect from 'effect/Effect'
import * as Layer from 'effect/Layer'
import { env } from '@/env'
import {
  makeSentryAnalyticsLayer,
  NoopAnalyticsLayer
} from '@/services/analytics'

const analyticsLayer = env.sentryDsn
  ? makeSentryAnalyticsLayer({
      dsn: env.sentryDsn,
      environment:
        env.sentryEnvironment ?? (env.isDev ? 'development' : 'production'),
      debug: env.isDev,
      tracesSampleRate: env.isDev ? 1.0 : 0.1
    })
  : NoopAnalyticsLayer

const mainLayerPromise = Effect.runPromise(
  Effect.scoped(Layer.build(analyticsLayer))
)

export const runAppEffect = <A, E>(effect: Effect.Effect<A, E>) =>
  mainLayerPromise
    .then((services) =>
      Effect.runPromise(effect.pipe(Effect.provide(services)))
    )
    .catch((error) => {
      console.error('App effect failed', error)
      throw error
    })
