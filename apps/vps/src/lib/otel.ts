import { NodeSdk } from '@effect/opentelemetry'
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http'
import {
  BatchSpanProcessor,
  ConsoleSpanExporter,
  SimpleSpanProcessor
} from '@opentelemetry/sdk-trace-base'
import type { Layer } from 'effect'
import { config } from '@/services/config.service'

const DEFAULT_OTLP_ENDPOINT = 'http://localhost:4318'

const otlpEndpoint = (config.otel.endpoint || DEFAULT_OTLP_ENDPOINT).replace(
  /\/$/,
  ''
)

const traceExporterUrl = otlpEndpoint.endsWith('/v1/traces')
  ? otlpEndpoint
  : `${otlpEndpoint}/v1/traces`

console.log('[OTEL] Exporting traces to:', traceExporterUrl)

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

export const OtlpLive: Layer.Layer<never> = NodeSdk.layer(() => ({
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
