import { NodeSdk } from '@effect/opentelemetry'
import { propagation, trace } from '@opentelemetry/api'
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http'
import { SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base'
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node'
import { SentryPropagator, SentrySampler, SentrySpanProcessor } from '@sentry/opentelemetry'
import { Effect, Layer } from 'effect'
import { ConfigService } from '@/services/config.service'
import { SentryClientService } from '@/services/sentry-client.service'

function parseOtelHeaders(headers: string | undefined) {
  if (!headers) return undefined

  return headers
    .split(',')
    .map((header) => header.trim())
    .filter(Boolean)
    .reduce<Record<string, string>>((acc, header) => {
      const separatorIndex = header.indexOf('=')
      if (separatorIndex === -1) return acc
      const key = header.slice(0, separatorIndex).trim()
      const value = header.slice(separatorIndex + 1).trim()
      if (key && value) acc[key] = value
      return acc
    }, {})
}

const MOTEL_TRACES_URL = 'http://127.0.0.1:27686/v1/traces'

export const OtlpLive = Effect.gen(function* () {
  const config = yield* ConfigService
  const sentry = yield* SentryClientService
  const otlpEndpoint = (config.otel.endpoint || '').replace(/\/$/, '')
  const otelHeaders = parseOtelHeaders(config.otel.headers)

  const makeSpanProcessors = () => [
    ...(sentry.enabled ? [new SentrySpanProcessor()] : []),
    ...(otlpEndpoint
      ? [
          new SimpleSpanProcessor(
            new OTLPTraceExporter({
              url: otlpEndpoint.endsWith('/v1/traces') ? otlpEndpoint : `${otlpEndpoint}/v1/traces`,
              ...(otelHeaders ? { headers: otelHeaders } : {})
            })
          )
        ]
      : []),
    // Dual export in dev: Jaeger (above) for the trace-waterfall UI, motel
    // (github.com/kitlangton/motel) for terminal/agent-queryable local
    // telemetry. Span export failures are caught by OTel's own SDK and never
    // throw into the request path, so this is safe to leave unconditional
    // within the dev/local gate even when the motel server isn't running.
    ...(['dev', 'local'].includes(config.app.stage)
      ? [new SimpleSpanProcessor(new OTLPTraceExporter({ url: MOTEL_TRACES_URL }))]
      : [])
  ]

  if (sentry.client) {
    propagation.setGlobalPropagator(new SentryPropagator())
  }

  const tracerConfig = sentry.client ? { sampler: new SentrySampler(sentry.client) } : undefined
  const globalProviderLive = Layer.effectDiscard(
    Effect.acquireRelease(
      Effect.sync(() => {
        const provider = new NodeTracerProvider({
          spanProcessors: makeSpanProcessors(),
          ...(tracerConfig ? { sampler: tracerConfig.sampler } : {})
        })
        provider.register()
        return provider
      }),
      (provider) =>
        Effect.promise(async () => {
          await provider.forceFlush()
          await provider.shutdown()
          trace.disable()
        }).pipe(Effect.ignore)
    )
  )
  const effectTracingLive = NodeSdk.layer(() => ({
    resource: {
      serviceName: 'goosebumps-fm-api',
      serviceVersion: process.env.npm_package_version || '1.0.0',
      serviceNamespace: 'application',
      attributes: {
        'deployment.environment': config.app.nodeEnv
      }
    },
    spanProcessor: makeSpanProcessors(),
    ...(tracerConfig ? { tracerConfig } : {})
  }))

  return Layer.merge(effectTracingLive, globalProviderLive)
}).pipe(Layer.unwrap)
