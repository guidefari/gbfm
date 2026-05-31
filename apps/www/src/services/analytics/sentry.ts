import * as Sentry from '@sentry/react'
import * as Effect from 'effect/Effect'
import * as Layer from 'effect/Layer'
import type { AnalyticsProperties } from './service'
import { Analytics } from './service'

const isLocalUrl = (value: unknown) =>
  typeof value === 'string' &&
  (value.includes('127.0.0.1') || value.includes('localhost'))

const hasLocalUrl = (event: Sentry.Event) =>
  isLocalUrl(event.request?.url) ||
  event.spans?.some(
    (span) => isLocalUrl(span.description) || isLocalUrl(span.data?.url)
  )

export interface SentryAnalyticsOptions {
  readonly dsn: string
  readonly environment?: string
  readonly debug?: boolean
  readonly enableSessionReplay?: boolean
  readonly tracesSampleRate?: number
  readonly replaysOnErrorSampleRate?: number
  readonly tracePropagationTargets?: (string | RegExp)[]
  readonly release?: string
}

const makeSentryClientLayer = (options: SentryAnalyticsOptions) =>
  Layer.effectDiscard(
    Effect.sync(() => {
      const enableSessionReplay = options.enableSessionReplay ?? true

      Sentry.init({
        dsn: options.dsn,
        environment: options.environment,
        release: options.release,
        debug: options.debug ?? false,
        integrations: [
          Sentry.browserTracingIntegration(),
          ...(enableSessionReplay
            ? [
                Sentry.replayIntegration({
                  maskAllText: false,
                  blockAllMedia: false
                })
              ]
            : [])
        ],
        tracesSampleRate: options.tracesSampleRate ?? 0.1,
        tracePropagationTargets: options.tracePropagationTargets,
        replaysSessionSampleRate: 0,
        replaysOnErrorSampleRate: enableSessionReplay
          ? (options.replaysOnErrorSampleRate ?? 1.0)
          : 0,
        sendDefaultPii: false,
        beforeSend: (event) => {
          return hasLocalUrl(event) ? null : event
        },
        beforeSendTransaction: (event) => {
          return hasLocalUrl(event) ? null : event
        }
      })
    })
  )

const SentryAnalyticsImpl = Layer.sync(Analytics, () => {
  const track = Effect.fn('Analytics.track')(
    (event: string, properties?: AnalyticsProperties) =>
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

  const page = Effect.fn('Analytics.page')(
    (name?: string, properties?: AnalyticsProperties) =>
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

export const makeSentryAnalyticsLayer = (options: SentryAnalyticsOptions) =>
  Layer.provideMerge(SentryAnalyticsImpl, makeSentryClientLayer(options))

export const captureException = (
  error: unknown,
  context?: AnalyticsProperties
) =>
  Effect.sync(() => {
    Sentry.captureException(error, context ? { extra: context } : undefined)
  })
