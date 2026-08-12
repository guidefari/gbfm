import * as Context from 'effect/Context'
import type * as Effect from 'effect/Effect'

/**
 * Generic event payload shape shared across analytics providers.
 * Keep values serializable for compatibility across backends.
 */
export type AnalyticsValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | readonly AnalyticsValue[]
  | { readonly [key: string]: AnalyticsValue }
export type AnalyticsProperties = Readonly<Record<string, AnalyticsValue>>

/**
 * Effect service contract for analytics/event tracking.
 *
 * This interface is intentionally provider-agnostic so implementations can be
 * swapped without changing call sites.
 */
export class Analytics extends Context.Service<
  Analytics,
  {
    /**
     * Capture an arbitrary event with optional properties.
     */
    readonly track: (event: string, properties?: AnalyticsProperties) => Effect.Effect<void>
    /**
     * Associate future events with a stable user identity.
     */
    readonly identify: (userId: string, properties?: AnalyticsProperties) => Effect.Effect<void>
    /**
     * Record a page/screen view event.
     */
    readonly page: (name?: string, properties?: AnalyticsProperties) => Effect.Effect<void>
    /**
     * Clear analytics identity/session state on the current client.
     */
    readonly reset: () => Effect.Effect<void>
  }
>()('@gbfm/www/Analytics') {}

/**
 * Accessor helper for `Analytics.track`.
 */
export const track = (event: string, properties?: AnalyticsProperties) =>
  Analytics.use((analytics) => analytics.track(event, properties))

/**
 * Accessor helper for `Analytics.identify`.
 */
export const identify = (userId: string, properties?: AnalyticsProperties) =>
  Analytics.use((analytics) => analytics.identify(userId, properties))

/**
 * Accessor helper for `Analytics.page`.
 */
export const page = (name?: string, properties?: AnalyticsProperties) =>
  Analytics.use((analytics) => analytics.page(name, properties))

/**
 * Accessor helper for `Analytics.reset`.
 */
export const reset = () => Analytics.use((analytics) => analytics.reset())
