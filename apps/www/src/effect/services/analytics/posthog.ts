import { Effect, Layer } from 'effect'
import posthog from 'posthog-js'
import type { AnalyticsProperties } from './service'
import { Analytics } from './service'

export interface PostHogAnalyticsOptions {
  readonly apiKey: string
  readonly apiHost: string
  readonly debug?: boolean
}

export const makePostHogAnalyticsLayer = ({
  apiKey,
  apiHost,
  debug = false
}: PostHogAnalyticsOptions) =>
  Layer.sync(Analytics, () => {
    posthog.init(apiKey, {
      api_host: apiHost,
      defaults: '2025-05-24',
      capture_exceptions: true,
      debug
    })

    const track = Effect.fn('Analytics.track')(
      (event: string, properties?: AnalyticsProperties) =>
        Effect.sync(() => {
          posthog.capture(event, properties)
        })
    )

    const identify = Effect.fn('Analytics.identify')(
      (userId: string, properties?: AnalyticsProperties) =>
        Effect.sync(() => {
          posthog.identify(userId, properties)
        })
    )

    const page = Effect.fn('Analytics.page')(
      (name?: string, properties?: AnalyticsProperties) =>
        Effect.sync(() => {
          posthog.capture('$pageview', {
            ...(name ? { name } : {}),
            ...(properties ?? {})
          })
        })
    )

    const reset = Effect.fn('Analytics.reset')(() =>
      Effect.sync(() => {
        posthog.reset()
      })
    )

    return Analytics.of({
      track,
      identify,
      page,
      reset
    })
  })
