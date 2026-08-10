import { Layer } from 'effect'
import { OtlpLive } from '@/lib/otel'
import { SentryClientServiceLayer, SentryEnabledLive } from '@/services/sentry-client.service'
import { ConfigServiceLayer } from '@/services/config.service'
import { SentryServiceLayer } from '@/services/sentry.service'

// The Bun/ECS runtime's Sentry + Effect-tracing wiring, kept out of
// runtime/services.ts so that file (shared with the Worker) never imports
// @sentry/bun or the Node-only OpenTelemetry SDK packages OtlpLive pulls in.
const SentryClientLive = SentryClientServiceLayer.pipe(Layer.provide(ConfigServiceLayer))

export const BunSentryServiceLive = SentryServiceLayer.pipe(
  Layer.provide(SentryEnabledLive),
  Layer.provide(SentryClientLive)
)

export const BunTracingLive = OtlpLive.pipe(
  Layer.provide(SentryClientLive),
  Layer.provide(ConfigServiceLayer)
)
