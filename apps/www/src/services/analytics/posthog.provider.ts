import { Effect, Layer } from 'effect'
import posthog from 'posthog-js'
import {
  AnalyticsService,
  type EventProperties,
  type UserProperties
} from './analytics.service'

/**
 * PostHog configuration options
 */
export interface PostHogConfig {
  apiKey: string
  apiHost?: string
  debug?: boolean
  captureExceptions?: boolean
  autocapture?: boolean
  disableSessionRecording?: boolean
}

/**
 * Creates a PostHog implementation of the Analytics service
 */
export const makePostHogAnalyticsService = (
  config: PostHogConfig
): AnalyticsService => {
  // Initialize PostHog if not already initialized
  if (!posthog.__loaded) {
    posthog.init(config.apiKey, {
      api_host: config.apiHost ?? 'https://us.i.posthog.com',
      capture_exceptions: config.captureExceptions ?? true,
      autocapture: config.autocapture ?? true,
      disable_session_recording: config.disableSessionRecording ?? false,
      loaded: (ph) => {
        if (config.debug) {
          ph.debug()
        }
      }
    })
  }

  return {
    track: (eventName: string, properties?: EventProperties) =>
      Effect.sync(() => {
        posthog.capture(eventName, properties)
      }),

    identify: (userId: string, properties?: UserProperties) =>
      Effect.sync(() => {
        posthog.identify(userId, properties)
      }),

    reset: () =>
      Effect.sync(() => {
        posthog.reset()
      }),

    pageView: (pageName?: string, properties?: EventProperties) =>
      Effect.sync(() => {
        posthog.capture('$pageview', {
          $current_url: window.location.href,
          ...(pageName && { page_name: pageName }),
          ...properties
        })
      }),

    setUserProperties: (properties: UserProperties) =>
      Effect.sync(() => {
        posthog.setPersonProperties(properties)
      }),

    registerSuperProperties: (properties: EventProperties) =>
      Effect.sync(() => {
        posthog.register(properties)
      }),

    optOut: () =>
      Effect.sync(() => {
        posthog.opt_out_capturing()
      }),

    optIn: () =>
      Effect.sync(() => {
        posthog.opt_in_capturing()
      }),

    hasOptedOut: () =>
      Effect.sync(() => {
        return posthog.has_opted_out_capturing()
      }),

    startSessionRecording: () =>
      Effect.sync(() => {
        posthog.startSessionRecording()
      }),

    stopSessionRecording: () =>
      Effect.sync(() => {
        posthog.stopSessionRecording()
      })
  }
}

/**
 * Creates a PostHog Analytics Layer from configuration
 */
export const PostHogAnalyticsLive = (config: PostHogConfig) =>
  Layer.succeed(AnalyticsService, makePostHogAnalyticsService(config))
