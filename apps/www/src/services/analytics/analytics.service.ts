import { Context, Effect, Layer } from 'effect'

/**
 * Analytics event properties - flexible key-value pairs
 */
export type EventProperties = Record<string, unknown>

/**
 * User properties for identification
 */
export interface UserProperties {
  email?: string
  name?: string
  [key: string]: unknown
}

/**
 * Analytics service interface - provider-agnostic abstraction
 *
 * This interface defines the contract for analytics operations.
 * Implementations can be swapped (PostHog, Sentry, Mixpanel, etc.)
 * without changing the consuming code.
 */
export interface AnalyticsService {
  /**
   * Track a custom event
   */
  readonly track: (
    eventName: string,
    properties?: EventProperties
  ) => Effect.Effect<void>

  /**
   * Identify a user with optional properties
   */
  readonly identify: (
    userId: string,
    properties?: UserProperties
  ) => Effect.Effect<void>

  /**
   * Reset the current user (on logout)
   */
  readonly reset: () => Effect.Effect<void>

  /**
   * Track a page view
   */
  readonly pageView: (
    pageName?: string,
    properties?: EventProperties
  ) => Effect.Effect<void>

  /**
   * Set user properties without identifying
   */
  readonly setUserProperties: (
    properties: UserProperties
  ) => Effect.Effect<void>

  /**
   * Register super properties (sent with every event)
   */
  readonly registerSuperProperties: (
    properties: EventProperties
  ) => Effect.Effect<void>

  /**
   * Opt user out of tracking
   */
  readonly optOut: () => Effect.Effect<void>

  /**
   * Opt user back into tracking
   */
  readonly optIn: () => Effect.Effect<void>

  /**
   * Check if user has opted out
   */
  readonly hasOptedOut: () => Effect.Effect<boolean>

  /**
   * Start a session recording (if supported)
   */
  readonly startSessionRecording: () => Effect.Effect<void>

  /**
   * Stop session recording (if supported)
   */
  readonly stopSessionRecording: () => Effect.Effect<void>
}

/**
 * Analytics service tag for Effect dependency injection
 */
export const AnalyticsService =
  Context.GenericTag<AnalyticsService>('AnalyticsService')

/**
 * No-op analytics implementation for testing or when analytics is disabled
 */
export const AnalyticsServiceNoop = Layer.succeed(AnalyticsService, {
  track: () => Effect.void,
  identify: () => Effect.void,
  reset: () => Effect.void,
  pageView: () => Effect.void,
  setUserProperties: () => Effect.void,
  registerSuperProperties: () => Effect.void,
  optOut: () => Effect.void,
  optIn: () => Effect.void,
  hasOptedOut: () => Effect.succeed(false),
  startSessionRecording: () => Effect.void,
  stopSessionRecording: () => Effect.void
})
