import * as Sentry from '@sentry/react'
import { Effect, Layer } from 'effect'
import type { AnalyticsProperties } from './service'
import { Analytics } from './service'

export interface SentryAnalyticsOptions {
  readonly dsn: string
  readonly environment?: string
  readonly debug?: boolean
}

export const makeSentryAnalyticsLayer = ({
  dsn,
  environment,
  debug = false
}: SentryAnalyticsOptions) =>
  Layer.sync(Analytics, () => {
    Sentry.init({
      dsn,
      environment,
      debug
    })

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

    return Analytics.of({
      track,
      identify,
      page,
      reset
    })
  })
