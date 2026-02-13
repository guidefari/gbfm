import { Layer, ManagedRuntime } from 'effect'
import { env } from '@/env'
import {
  makePostHogAnalyticsLayer,
  NoopAnalyticsLayer
} from '@/services/analytics'

const analyticsLayer =
  env.posthogKey && env.posthogHost
    ? makePostHogAnalyticsLayer({
        apiKey: env.posthogKey,
        apiHost: env.posthogHost,
        debug: env.isDev
      })
    : NoopAnalyticsLayer

const MainLayer = Layer.mergeAll(analyticsLayer)

export const RuntimeClient = ManagedRuntime.make(MainLayer)
