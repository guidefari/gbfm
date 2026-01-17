/**
 * OpenTelemetry Telemetry Module
 *
 * Central export for all telemetry functionality.
 *
 * Usage:
 * ```ts
 * import { initializeTelemetry } from '@/lib/telemetry'
 *
 * // Initialize at app startup
 * initializeTelemetry()
 * ```
 */

// Initialization
export { initializeTelemetry, getTracer, getMeter } from './init'

// Metrics
export {
  httpMetrics,
  dbMetrics,
  mixMetrics,
  emailMetrics,
  cronMetrics,
  userMetrics,
  storageMetrics,
  recordHttpRequest,
  recordDbQuery
} from './metrics'

// Effect Integration
export {
  TelemetryService,
  TelemetryServiceLive,
  withSpan,
  addEvent,
  setAttributes,
  recordException,
  instrumentCron
} from './effect'

// Re-export OpenTelemetry API for convenience
export { trace, context, SpanStatusCode } from '@opentelemetry/api'
