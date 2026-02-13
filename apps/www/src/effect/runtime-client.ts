import { Layer, ManagedRuntime } from 'effect'
import {
  makePostHogAnalyticsLayer,
  NoopAnalyticsLayer
} from '@/effect/services/analytics'
import { env } from '@/env'

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
