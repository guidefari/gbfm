import * as Sentry from '@sentry/react'
import * as Effect from 'effect/Effect'
import * as Layer from 'effect/Layer'
import type { AnalyticsProperties } from './service'
import { Analytics } from './service'

const SentryAnalyticsImpl = Layer.sync(Analytics, () => {
  const track = Effect.fn('Analytics.track')((event: string, properties?: AnalyticsProperties) =>
    Effect.sync(() => {
      Sentry.addBreadcrumb({
        category: 'analytics.track',
        message: event,
        level: 'info',
        data: properties
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

  const page = Effect.fn('Analytics.page')((name?: string, properties?: AnalyticsProperties) =>
    Effect.sync(() => {
      Sentry.addBreadcrumb({
        category: 'analytics.page',
        message: name ?? 'pageview',
        level: 'info',
        data: properties
      })
    })
  )

  const reset = Effect.fn('Analytics.reset')(() =>
    Effect.sync(() => {
      Sentry.setUser(null)
      Sentry.setContext('user_properties', null)
    })
  )

  return { track, identify, page, reset }
})

export const SentryAnalyticsLayer = SentryAnalyticsImpl

export const captureException = (error: unknown, context?: AnalyticsProperties) =>
  Effect.sync(() => {
    Sentry.captureException(error, context ? { extra: context } : undefined)
  })
