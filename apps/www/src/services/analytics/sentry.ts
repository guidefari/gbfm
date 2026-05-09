import * as Sentry from '@sentry/react'
import { Effect, Layer } from 'effect'
import type { AnalyticsProperties } from './service'
import { Analytics } from './service'

export interface SentryAnalyticsOptions {
  readonly dsn: string
  readonly environment?: string
  readonly debug?: boolean
  readonly tracesSampleRate?: number
  readonly replaysOnErrorSampleRate?: number
}

const makeSentryClientLayer = (options: SentryAnalyticsOptions) =>
  Layer.scopedDiscard(
    Effect.acquireRelease(
      Effect.sync(() => {
        Sentry.init({
          dsn: options.dsn,
          environment: options.environment,
          debug: options.debug ?? false,
          integrations: [
            Sentry.browserTracingIntegration(),
            Sentry.replayIntegration({
              maskAllText: false,
              blockAllMedia: false
            })
          ],
          tracesSampleRate: options.tracesSampleRate ?? 0.1,
          replaysSessionSampleRate: 0,
          replaysOnErrorSampleRate: options.replaysOnErrorSampleRate ?? 1.0,
          sendDefaultPii: false
        })
      }),
      () => Effect.promise(() => Sentry.close(2000).then(() => undefined))
    )
  )

const SentryAnalyticsImpl = Layer.sync(Analytics, () => {
  const track = Effect.fn('Analytics.track')(
    (event: string, properties?: AnalyticsProperties) =>
      Effect.sync(() => {
        Sentry.captureEvent({
          message: event,
          level: 'info',
          extra: properties
        })
      })
  )

  const identify = Effect.fn('Analytics.identify')(
    (userId: string, properties?: AnalyticsProperties) =>
      Effect.sync(() => {
        Sentry.setUser({ id: userId })
        Sentry.setContext('user_properties', properties ?? null)
      })
  )

  const page = Effect.fn('Analytics.page')(
    (name?: string, properties?: AnalyticsProperties) =>
      Effect.sync(() => {
        Sentry.captureEvent({
          message: name ?? 'pageview',
          level: 'info',
          transaction: name,
          extra: properties
        })
      })
  )

  const reset = Effect.fn('Analytics.reset')(() =>
    Effect.sync(() => {
      Sentry.setUser(null)
      Sentry.setContext('user_properties', null)
    })
  )

  return Analytics.of({ track, identify, page, reset })
})

export const makeSentryAnalyticsLayer = (options: SentryAnalyticsOptions) =>
  Layer.provideMerge(SentryAnalyticsImpl, makeSentryClientLayer(options))

export const captureException = (
  error: unknown,
  context?: AnalyticsProperties
) =>
  Effect.sync(() => {
    Sentry.captureException(error, context ? { extra: context } : undefined)
  })
