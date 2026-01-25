import { Effect } from 'effect'
import { recordDbQuery, recordServiceOperation } from './metrics'

// ============================================================================
// Service Tracing Helpers
// ============================================================================

export interface SpanAttributes {
  [key: string]: string | number | boolean | undefined
}

/**
 * Wrap a service operation with tracing and metrics.
 * Creates a span for the operation and records duration/success metrics.
 *
 * @example
 * ```ts
 * const getUser = (id: string) =>
 *   withServiceSpan('user', 'getById', { userId: id })(
 *     Effect.gen(function* () {
 *       // operation logic
 *     })
 *   )
 * ```
 */
export const withServiceSpan =
  <A, E, R>(
    service: string,
    operation: string,
    attributes?: SpanAttributes
  ) =>
  (effect: Effect.Effect<A, E, R>): Effect.Effect<A, E, R> =>
    Effect.gen(function* () {
      const startTime = performance.now()
      let isError = false

      try {
        const result = yield* effect.pipe(
          Effect.withSpan(`${service}.${operation}`, {
            attributes: {
              'service.name': service,
              'operation.name': operation,
              ...filterUndefined(attributes)
            }
          })
        )
        return result
      } catch (error) {
        isError = true
        throw error
      } finally {
        const durationMs = performance.now() - startTime
        yield* recordServiceOperation(service, operation, durationMs, isError)
      }
    })

/**
 * Wrap a database query with tracing and metrics.
 *
 * @example
 * ```ts
 * const users = yield* withDbSpan('users', 'select', { userId })(
 *   Effect.tryPromise(() => db.select().from(usersTable))
 * )
 * ```
 */
export const withDbSpan =
  <A, E, R>(
    table: string,
    operation: 'select' | 'insert' | 'update' | 'delete',
    attributes?: SpanAttributes
  ) =>
  (effect: Effect.Effect<A, E, R>): Effect.Effect<A, E, R> =>
    Effect.gen(function* () {
      const startTime = performance.now()
      let isError = false

      try {
        const result = yield* effect.pipe(
          Effect.withSpan(`db.${table}.${operation}`, {
            attributes: {
              'db.table': table,
              'db.operation': operation,
              ...filterUndefined(attributes)
            }
          })
        )
        return result
      } catch (error) {
        isError = true
        throw error
      } finally {
        const durationMs = performance.now() - startTime
        yield* recordDbQuery(table, operation, durationMs, isError)
      }
    })

/**
 * Annotate the current span with additional attributes.
 * Use this to add context as you progress through an operation.
 *
 * @example
 * ```ts
 * yield* annotateSpan({ resultCount: results.length, hasMore: offset + limit < total })
 * ```
 */
export const annotateSpan = (attributes: SpanAttributes) =>
  Effect.gen(function* () {
    for (const [key, value] of Object.entries(attributes)) {
      if (value !== undefined) {
        yield* Effect.annotateCurrentSpan(key, value)
      }
    }
  })

/**
 * Create a child span for a sub-operation within a larger operation.
 * Useful for tracing individual steps within a service method.
 *
 * @example
 * ```ts
 * const compiled = yield* childSpan('mdx.compile', { contentLength: content.length })(
 *   Effect.tryPromise(() => compileMdx(content))
 * )
 * ```
 */
export const childSpan =
  <A, E, R>(name: string, attributes?: SpanAttributes) =>
  (effect: Effect.Effect<A, E, R>): Effect.Effect<A, E, R> =>
    effect.pipe(
      Effect.withSpan(name, {
        attributes: filterUndefined(attributes)
      })
    )

/**
 * Log an event within the current span.
 * Events are timestamped markers within a span.
 */
export const spanEvent = (name: string, attributes?: SpanAttributes) =>
  Effect.gen(function* () {
    yield* Effect.logInfo(`[Span Event] ${name}`, filterUndefined(attributes))
    yield* Effect.annotateCurrentSpan(`event.${name}`, Date.now())
  })

/**
 * Mark an error within the current span without failing the effect.
 */
export const spanError = (error: unknown, context?: string) =>
  Effect.gen(function* () {
    const errorMessage = error instanceof Error ? error.message : String(error)
    const errorType = error instanceof Error ? error.name : 'Error'

    yield* Effect.annotateCurrentSpan('error', true)
    yield* Effect.annotateCurrentSpan('error.type', errorType)
    yield* Effect.annotateCurrentSpan('error.message', errorMessage)

    if (context) {
      yield* Effect.annotateCurrentSpan('error.context', context)
    }
  })

// ============================================================================
// Composite Tracing Patterns
// ============================================================================

/**
 * Trace a database query with automatic error handling.
 * Creates a span, records metrics, and provides structured error context.
 *
 * @example
 * ```ts
 * const user = yield* tracedQuery(
 *   'users',
 *   'select',
 *   () => db.select().from(usersTable).where(eq(usersTable.id, id)),
 *   { userId: id }
 * )
 * ```
 */
export const tracedQuery = <T>(
  table: string,
  operation: 'select' | 'insert' | 'update' | 'delete',
  queryFn: () => Promise<T>,
  attributes?: SpanAttributes
): Effect.Effect<T, Error> =>
  withDbSpan(
    table,
    operation,
    attributes
  )(
    Effect.tryPromise({
      try: queryFn,
      catch: (error) => {
        const err = error instanceof Error ? error : new Error(String(error))
        err.message = `[${table}.${operation}] ${err.message}`
        return err
      }
    })
  )

/**
 * Trace an external API call with automatic error handling.
 *
 * @example
 * ```ts
 * const track = yield* tracedExternalCall(
 *   'spotify',
 *   'getTrack',
 *   () => spotifyClient.tracks.get(id),
 *   { trackId: id }
 * )
 * ```
 */
export const tracedExternalCall = <T, E>(
  api: string,
  endpoint: string,
  callFn: () => Promise<T>,
  attributes?: SpanAttributes,
  errorMapper?: (error: unknown) => E
): Effect.Effect<T, E | Error> =>
  Effect.gen(function* () {
    const startTime = performance.now()

    const result = yield* Effect.tryPromise({
      try: callFn,
      catch: (error) => {
        if (errorMapper) {
          return errorMapper(error)
        }
        return error instanceof Error ? error : new Error(String(error))
      }
    }).pipe(
      Effect.withSpan(`external.${api}.${endpoint}`, {
        attributes: {
          'external.api': api,
          'external.endpoint': endpoint,
          ...filterUndefined(attributes)
        }
      })
    )

    const durationMs = performance.now() - startTime
    yield* Effect.annotateCurrentSpan('duration_ms', Math.round(durationMs))

    return result
  })

// ============================================================================
// Utility Functions
// ============================================================================

function filterUndefined(
  obj?: SpanAttributes
): Record<string, string | number | boolean> {
  if (!obj) return {}

  return Object.fromEntries(
    Object.entries(obj).filter(([_, v]) => v !== undefined)
  ) as Record<string, string | number | boolean>
}

/**
 * Extract span context for logging.
 * Useful for correlating logs with traces.
 */
export const getSpanContext = () =>
  Effect.gen(function* () {
    // Note: In a full implementation, this would extract the actual trace/span IDs
    // from the OpenTelemetry context. For now, we generate a correlation ID.
    const correlationId = Math.random().toString(36).substring(2, 15)
    return {
      correlationId,
      timestamp: new Date().toISOString()
    }
  })
