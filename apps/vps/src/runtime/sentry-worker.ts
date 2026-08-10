import { OtelTracer, Resource } from '@effect/opentelemetry'
import { Context, Effect, Layer } from 'effect'
import { shouldEnableSentry } from '@/lib/sentry'
import { SentryEnabled } from '@/services/sentry.service'

// The Worker/workerd counterpart to runtime/sentry-bun.ts. @sentry/cloudflare
// initializes by wrapping the exported handler (Sentry.withSentry in
// worker.ts), not by calling init() at module scope, so there is no client to
// hold here -- only the enabled flag, read from per-request env instead of
// process.env/sst Resource (neither exists on workerd).
export interface WorkerSentryEnvShape {
  readonly dsn: string | undefined
  readonly environment: string | undefined
}

export class WorkerSentryEnv extends Context.Service<WorkerSentryEnv, WorkerSentryEnvShape>()(
  'WorkerSentryEnv'
) {}

export const WorkerSentryEnabledLive = Layer.effect(
  SentryEnabled,
  Effect.gen(function* () {
    const { dsn, environment } = yield* WorkerSentryEnv
    return { enabled: shouldEnableSentry(dsn ?? '', environment ?? 'development') }
  })
)

// @sentry/cloudflare's withSentry() registers the global OpenTelemetry
// tracer provider itself (unless skipOpenTelemetrySetup is set), the same
// role @opentelemetry/sdk-trace-node's NodeTracerProvider plays for Bun in
// lib/otel.ts. This layer only needs to read that already-registered global
// provider and attach Effect's Resource metadata -- it must not import
// sdk-trace-node, sdk-trace-base, or the OTLP HTTP exporter, all of which are
// Node-only and unreachable from workerd.
export const WorkerTracingLive = OtelTracer.layerGlobal.pipe(
  Layer.provide(
    Resource.layer({
      serviceName: 'goosebumps-fm-api',
      serviceVersion: '1.0.0',
      attributes: {
        'service.namespace': 'application'
      }
    })
  )
)
