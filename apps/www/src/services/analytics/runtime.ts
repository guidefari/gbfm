import { Effect, Layer, ManagedRuntime } from 'effect'
import { env } from '@/env'
import { AnalyticsService, AnalyticsServiceNoop } from './analytics.service'
import { PostHogAnalyticsLive } from './posthog.provider'

/**
 * Create the analytics layer based on environment configuration
 */
const createAnalyticsLayer = (): Layer.Layer<AnalyticsService> => {
  const apiKey = import.meta.env.VITE_PUBLIC_POSTHOG_KEY
  const apiHost = import.meta.env.VITE_PUBLIC_POSTHOG_HOST

  // Use noop if PostHog is not configured
  if (!apiKey) {
    if (env.isDev) {
      console.warn(
        '[Analytics] PostHog API key not configured, using noop provider'
      )
    }
    return AnalyticsServiceNoop
  }

  return PostHogAnalyticsLive({
    apiKey,
    apiHost,
    debug: env.isDev,
    captureExceptions: true
  })
}

/**
 * The main analytics layer for the application
 */
export const AnalyticsLive = createAnalyticsLayer()

/**
 * Managed runtime for running analytics effects
 */
export const AnalyticsRuntime = ManagedRuntime.make(AnalyticsLive)

/**
 * Run an analytics effect synchronously (fire-and-forget)
 * Use this for non-critical analytics operations
 */
export const runAnalytics = <A>(
  effect: Effect.Effect<A, never, AnalyticsService>
): void => {
  AnalyticsRuntime.runPromise(effect).catch((error) => {
    if (env.isDev) {
      console.error('[Analytics] Error:', error)
    }
  })
}

/**
 * Run an analytics effect and return a promise
 * Use this when you need to await the result
 */
export const runAnalyticsAsync = <A>(
  effect: Effect.Effect<A, never, AnalyticsService>
): Promise<A> => {
  return AnalyticsRuntime.runPromise(effect)
}
