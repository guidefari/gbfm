import { NodeSdk } from '@effect/opentelemetry'
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http'
import {
  BatchSpanProcessor,
  ConsoleSpanExporter,
  SimpleSpanProcessor
} from '@opentelemetry/sdk-trace-base'
import { Effect, Layer } from 'effect'
import { ConfigService } from '@/services/config.service'

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

      if (key && value) {
        acc[key] = value
      }

      return acc
    }, {})
}

export const OtlpLive: Layer.Layer<never> = Layer.flatMap(
  ConfigService,
  (config) =>
    Effect.sync(() => {
      const otlpEndpoint = (config.otel.endpoint || '').replace(/\/$/, '')

      const traceExporterUrl = otlpEndpoint.endsWith('/v1/traces')
        ? otlpEndpoint
        : `${otlpEndpoint}/v1/traces`

      console.log('[OTEL] Exporting traces to:', traceExporterUrl)

      const otelHeaders = parseOtelHeaders(config.otel.headers)

      const spanProcessor = [
        ...(config.app.nodeEnv === 'production'
          ? []
          : [new SimpleSpanProcessor(new ConsoleSpanExporter())]),
        new BatchSpanProcessor(
          new OTLPTraceExporter({
            url: traceExporterUrl,
            ...(otelHeaders ? { headers: otelHeaders } : {})
          })
        )
      ]

      return NodeSdk.layer(() => ({
        resource: {
          serviceName: 'goosebumps-fm-api',
          serviceVersion: process.env.npm_package_version || '1.0.0',
          serviceNamespace: 'application',
          attributes: {
            'deployment.environment': config.app.nodeEnv
          }
        },
        spanProcessor
      }))
    }).pipe(Layer.unwrap)
)
