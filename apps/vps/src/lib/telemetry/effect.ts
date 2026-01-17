/**
 * Effect Integration with OpenTelemetry
 *
 * This module provides utilities to integrate Effect with OpenTelemetry,
 * enabling distributed tracing for your Effect-based code.
 *
 * Features:
 * - Automatic span creation for Effect operations
 * - Error recording with proper context
 * - Nested span support for Effect chains
 * - Attribute and event support
 */

import { Effect, Context, Layer } from 'effect'
import { trace, context as otelContext, SpanStatusCode, type Span } from '@opentelemetry/api'
import { getTracer } from './init'

/**
 * Telemetry Service Context
 */
export interface TelemetryService {
  readonly tracer: ReturnType<typeof getTracer>
  readonly withSpan: <A, E, R>(
    name: string,
    effect: Effect.Effect<A, E, R>,
    options?: SpanOptions
  ) => Effect.Effect<A, E, R>
  readonly addEvent: (name: string, attributes?: Record<string, any>) => Effect.Effect<void>
  readonly setAttributes: (attributes: Record<string, any>) => Effect.Effect<void>
  readonly recordException: (error: unknown) => Effect.Effect<void>
}

export interface SpanOptions {
  attributes?: Record<string, string | number | boolean>
  kind?: 'internal' | 'server' | 'client' | 'producer' | 'consumer'
}

/**
 * Telemetry Service Tag
 */
export const TelemetryService = Context.GenericTag<TelemetryService>('TelemetryService')

/**
 * Create the Telemetry Service implementation
 */
const makeTelemetryService = Effect.sync((): TelemetryService => {
  const tracer = getTracer('effect-app')

  return {
    tracer,

    withSpan: <A, E, R>(
      name: string,
      effect: Effect.Effect<A, E, R>,
      options: SpanOptions = {}
    ): Effect.Effect<A, E, R> => {
      return Effect.gen(function* () {
        // Start a new span
        const span = tracer.startSpan(name, {
          attributes: options.attributes,
          kind: spanKindToNumber(options.kind || 'internal')
        })

        // Set the span in the OTEL context
        const ctx = trace.setSpan(otelContext.active(), span)

        try {
          // Run the effect within the span context
          const result = yield* otelContext.with(ctx, () => Effect.promise(() => Effect.runPromise(effect)))

          // Mark span as successful
          span.setStatus({ code: SpanStatusCode.OK })

          return result
        } catch (error) {
          // Record the exception
          span.recordException(error as Error)
          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: error instanceof Error ? error.message : String(error)
          })

          // Re-throw to maintain Effect error handling
          throw error
        } finally {
          // Always end the span
          span.end()
        }
      })
    },

    addEvent: (name: string, attributes?: Record<string, any>) =>
      Effect.sync(() => {
        const span = trace.getSpan(otelContext.active())
        span?.addEvent(name, attributes)
      }),

    setAttributes: (attributes: Record<string, any>) =>
      Effect.sync(() => {
        const span = trace.getSpan(otelContext.active())
        span?.setAttributes(attributes)
      }),

    recordException: (error: unknown) =>
      Effect.sync(() => {
        const span = trace.getSpan(otelContext.active())
        span?.recordException(error as Error)
        span?.setStatus({
          code: SpanStatusCode.ERROR,
          message: error instanceof Error ? error.message : String(error)
        })
      })
  }
})

/**
 * Telemetry Service Layer
 *
 * Use this layer to provide telemetry to your Effect programs.
 *
 * Example:
 * ```ts
 * import { TelemetryServiceLive } from '@/lib/telemetry/effect'
 *
 * const program = Effect.gen(function* () {
 *   const telemetry = yield* TelemetryService
 *   yield* telemetry.withSpan('my-operation', myEffect)
 * })
 *
 * Effect.runPromise(program.pipe(Effect.provide(TelemetryServiceLive)))
 * ```
 */
export const TelemetryServiceLive = Layer.effect(TelemetryService, makeTelemetryService)

/**
 * Helper function to wrap an Effect with a span
 *
 * This is a convenience function that doesn't require accessing the service.
 *
 * Example:
 * ```ts
 * import { withSpan } from '@/lib/telemetry/effect'
 *
 * const fetchUser = (id: string) =>
 *   withSpan('fetchUser', { 'user.id': id })(
 *     Effect.gen(function* () {
 *       const db = yield* DatabaseService
 *       return yield* db.getUser(id)
 *     })
 *   )
 * ```
 */
export function withSpan<A, E, R>(
  name: string,
  attributes?: Record<string, string | number | boolean>
) {
  return (effect: Effect.Effect<A, E, R>): Effect.Effect<A, E, R> => {
    const tracer = getTracer('effect-app')

    return Effect.gen(function* () {
      const span = tracer.startSpan(name, { attributes })
      const ctx = trace.setSpan(otelContext.active(), span)

      try {
        const result = yield* otelContext.with(ctx, () => Effect.promise(() => Effect.runPromise(effect)))
        span.setStatus({ code: SpanStatusCode.OK })
        return result
      } catch (error) {
        span.recordException(error as Error)
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: error instanceof Error ? error.message : String(error)
        })
        throw error
      } finally {
        span.end()
      }
    })
  }
}

/**
 * Helper to add an event to the current span
 *
 * Example:
 * ```ts
 * import { addEvent } from '@/lib/telemetry/effect'
 *
 * yield* addEvent('cache.miss', { key: 'user:123' })
 * ```
 */
export function addEvent(name: string, attributes?: Record<string, any>): Effect.Effect<void> {
  return Effect.sync(() => {
    const span = trace.getSpan(otelContext.active())
    span?.addEvent(name, attributes)
  })
}

/**
 * Helper to set attributes on the current span
 *
 * Example:
 * ```ts
 * import { setAttributes } from '@/lib/telemetry/effect'
 *
 * yield* setAttributes({ 'user.id': userId, 'user.tier': 'premium' })
 * ```
 */
export function setAttributes(attributes: Record<string, string | number | boolean>): Effect.Effect<void> {
  return Effect.sync(() => {
    const span = trace.getSpan(otelContext.active())
    span?.setAttributes(attributes)
  })
}

/**
 * Helper to record an exception in the current span
 *
 * Example:
 * ```ts
 * import { recordException } from '@/lib/telemetry/effect'
 *
 * yield* recordException(error)
 * ```
 */
export function recordException(error: unknown): Effect.Effect<void> {
  return Effect.sync(() => {
    const span = trace.getSpan(otelContext.active())
    span?.recordException(error as Error)
    span?.setStatus({
      code: SpanStatusCode.ERROR,
      message: error instanceof Error ? error.message : String(error)
    })
  })
}

/**
 * Instrument a cron job with tracing
 *
 * Example:
 * ```ts
 * import { instrumentCron } from '@/lib/telemetry/effect'
 * import cron from 'node-cron'
 *
 * cron.schedule('* * * * *', () => {
 *   instrumentCron('music-reminders', processPendingReminders)
 * })
 * ```
 */
export function instrumentCron<A, E, R>(
  jobName: string,
  effect: Effect.Effect<A, E, R>
): Promise<A> {
  return Effect.runPromise(
    withSpan(`cron.${jobName}`, { 'cron.job': jobName })(effect)
  )
}

// Helper functions

function spanKindToNumber(kind: 'internal' | 'server' | 'client' | 'producer' | 'consumer'): number {
  const kinds = {
    internal: 0,
    server: 1,
    client: 2,
    producer: 3,
    consumer: 4
  }
  return kinds[kind]
}
