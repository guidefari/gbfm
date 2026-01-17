/**
 * OpenTelemetry Middleware for Hono
 *
 * This middleware:
 * - Creates a span for each HTTP request
 * - Adds relevant HTTP attributes to the span
 * - Records metrics for request duration and response size
 * - Handles errors and adds them to spans
 * - Integrates with the request ID middleware
 */

import { trace, context, SpanStatusCode, type Span } from '@opentelemetry/api'
import { createMiddleware } from 'hono/factory'
import type { AppBindings } from '@/lib/types'
import { recordHttpRequest } from '@/lib/telemetry/metrics'

const tracer = trace.getTracer('hono-middleware')

/**
 * Main telemetry middleware
 */
export function telemetryMiddleware() {
  return createMiddleware<AppBindings>(async (c, next) => {
    const startTime = Date.now()

    // Extract request information
    const method = c.req.method
    const path = c.req.path
    const url = c.req.url
    const userAgent = c.req.header('user-agent') || ''
    const requestId = c.get('requestId')

    // Create a span for this request
    const span = tracer.startSpan(`HTTP ${method} ${path}`, {
      kind: 1, // SpanKind.SERVER
      attributes: {
        'http.method': method,
        'http.route': path,
        'http.url': url,
        'http.user_agent': userAgent,
        'http.scheme': new URL(url).protocol.replace(':', ''),
        'http.host': new URL(url).host,
        'http.target': new URL(url).pathname,
        'request.id': requestId || '',
        'net.peer.ip': c.req.header('x-forwarded-for') || 'unknown'
      }
    })

    // Store span in context for nested operations
    const ctx = trace.setSpan(context.active(), span)

    return context.with(ctx, async () => {
      try {
        // Continue with the request
        await next()

        // Request completed successfully
        const durationMs = Date.now() - startTime
        const statusCode = c.res.status

        // Add response attributes to span
        span.setAttributes({
          'http.status_code': statusCode,
          'http.response.duration_ms': durationMs
        })

        // Set span status based on HTTP status code
        if (statusCode >= 400 && statusCode < 500) {
          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: `Client error: ${statusCode}`
          })
        } else if (statusCode >= 500) {
          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: `Server error: ${statusCode}`
          })
        } else {
          span.setStatus({ code: SpanStatusCode.OK })
        }

        // Record metrics
        recordHttpRequest(
          method,
          path,
          statusCode,
          durationMs,
          parseInt(c.res.headers.get('content-length') || '0')
        )

        return
      } catch (error) {
        // Request failed with an exception
        const durationMs = Date.now() - startTime

        // Record the exception in the span
        span.recordException(error as Error)
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: (error as Error).message
        })

        // Add error attributes
        span.setAttributes({
          'error': true,
          'error.type': (error as Error).name,
          'error.message': (error as Error).message,
          'http.response.duration_ms': durationMs
        })

        // Record metrics for the failed request
        recordHttpRequest(method, path, 500, durationMs)

        // Re-throw the error to let Hono's error handler deal with it
        throw error
      } finally {
        // Always end the span
        span.end()
      }
    })
  })
}

/**
 * Get the current active span
 *
 * Use this to add custom attributes to the current request span
 * from within your route handlers.
 *
 * Example:
 * ```ts
 * import { getCurrentSpan } from '@/middlewares/telemetry'
 *
 * app.get('/users/:id', async (c) => {
 *   const span = getCurrentSpan()
 *   span?.setAttribute('user.id', c.req.param('id'))
 *   // ... rest of handler
 * })
 * ```
 */
export function getCurrentSpan(): Span | undefined {
  return trace.getSpan(context.active())
}

/**
 * Add a custom event to the current span
 *
 * Events are timestamped annotations that can add context to a span.
 *
 * Example:
 * ```ts
 * import { addSpanEvent } from '@/middlewares/telemetry'
 *
 * addSpanEvent('cache.miss', { key: 'user:123' })
 * ```
 */
export function addSpanEvent(name: string, attributes?: Record<string, string | number | boolean>) {
  const span = getCurrentSpan()
  if (span) {
    span.addEvent(name, attributes)
  }
}

/**
 * Set custom attributes on the current span
 *
 * Example:
 * ```ts
 * import { setSpanAttributes } from '@/middlewares/telemetry'
 *
 * setSpanAttributes({
 *   'user.id': userId,
 *   'user.tier': 'premium',
 *   'feature.enabled': true
 * })
 * ```
 */
export function setSpanAttributes(attributes: Record<string, string | number | boolean>) {
  const span = getCurrentSpan()
  if (span) {
    span.setAttributes(attributes)
  }
}

/**
 * Wrap an async function with a span
 *
 * This creates a child span for the operation and automatically
 * records exceptions if any occur.
 *
 * Example:
 * ```ts
 * import { withSpan } from '@/middlewares/telemetry'
 *
 * const user = await withSpan('db.getUser', { 'user.id': userId }, async () => {
 *   return await db.query.users.findFirst({ where: eq(users.id, userId) })
 * })
 * ```
 */
export async function withSpan<T>(
  name: string,
  attributes: Record<string, string | number | boolean>,
  fn: () => Promise<T>
): Promise<T> {
  const span = tracer.startSpan(name, { attributes })
  const ctx = trace.setSpan(context.active(), span)

  return context.with(ctx, async () => {
    try {
      const result = await fn()
      span.setStatus({ code: SpanStatusCode.OK })
      return result
    } catch (error) {
      span.recordException(error as Error)
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: (error as Error).message
      })
      throw error
    } finally {
      span.end()
    }
  })
}
