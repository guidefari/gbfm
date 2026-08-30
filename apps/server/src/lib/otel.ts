import { OtelTracer, Resource } from '@effect/opentelemetry'
import { trace } from '@opentelemetry/api'
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http'
import { resourceFromAttributes } from '@opentelemetry/resources'
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base'
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node'
import * as Sentry from '@sentry/bun'
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

const SERVICE_NAME = 'goosebumps-fm-api'
const LOCAL_TRACES_URL = 'http://127.0.0.1:4318/v1/traces'

const tracesUrl = (endpoint: string) => {
  const normalized = endpoint.replace(/\/$/, '')
  return normalized.endsWith('/v1/traces') ? normalized : `${normalized}/v1/traces`
}

export const OtlpLive = Effect.gen(function* () {
  const config = yield* ConfigService
  const sentry = yield* SentryClientService
  const otlpEndpoint = config.otel.endpoint || ''
  const otelHeaders = parseOtelHeaders(config.otel.headers)
  const isLocal = ['dev', 'local'].includes(config.app.stage)
  const exporterTargets = [
    ...(otlpEndpoint ? [{ url: tracesUrl(otlpEndpoint), headers: otelHeaders }] : []),
    ...(isLocal ? [{ url: LOCAL_TRACES_URL }] : [])
  ].filter(
    (target, index, targets) =>
      targets.findIndex((candidate) => candidate.url === target.url) === index
  )

  const makeAdditionalSpanProcessors = () =>
    exporterTargets.map(
      ({ url, headers }) =>
        new BatchSpanProcessor(
          new OTLPTraceExporter({
            url,
            headers
          }),
          // Keep local traces close to real time without making every span end
          // perform its own export. Production keeps the SDK batch defaults.
          isLocal ? { scheduledDelayMillis: 250 } : undefined
        )
    )

  const sentryClient = sentry.client
  const globalProviderLive = sentryClient
    ? Layer.effectDiscard(
        Effect.sync(() => {
          Sentry.initOpenTelemetry(sentryClient, {
            spanProcessors: makeAdditionalSpanProcessors()
          })
        })
      )
    : Layer.effectDiscard(
        Effect.acquireRelease(
          Effect.sync(() => {
            const provider = new NodeTracerProvider({
              resource: resourceFromAttributes({
                'service.name': SERVICE_NAME,
                'service.namespace': 'application',
                'service.version': process.env.npm_package_version || '1.0.0',
                'deployment.environment': config.app.nodeEnv
              }),
              spanProcessors: makeAdditionalSpanProcessors()
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

  const resourceLive = Resource.layer({
    serviceName: SERVICE_NAME,
    serviceVersion: process.env.npm_package_version || '1.0.0',
    attributes: {
      'service.namespace': 'application',
      'deployment.environment': config.app.nodeEnv
    }
  })
  const effectTracingLive = OtelTracer.layerGlobal.pipe(
    Layer.provide(Layer.merge(globalProviderLive, resourceLive))
  )

  return effectTracingLive
}).pipe(Layer.unwrap)
