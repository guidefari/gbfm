import { Layer, ManagedRuntime } from 'effect'
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

const MainLayer = Layer.mergeAll(analyticsLayer)

export const RuntimeClient = ManagedRuntime.make(MainLayer)
