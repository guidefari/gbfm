import { Layer, ManagedRuntime } from 'effect'
import { env } from '@/env'
import {
  makeSentryAnalyticsLayer,
  NoopAnalyticsLayer
} from '@/services/analytics'

const analyticsLayer = env.sentryDsn
  ? makeSentryAnalyticsLayer({
      dsn: env.sentryDsn,
      environment: env.sentryEnvironment,
      debug: env.isDev
    })
  : NoopAnalyticsLayer

const MainLayer = Layer.mergeAll(analyticsLayer)

export const RuntimeClient = ManagedRuntime.make(MainLayer)
