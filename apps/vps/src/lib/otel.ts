import { NodeSdk } from '@effect/opentelemetry'
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http'
import {
  BatchSpanProcessor,
  ConsoleSpanExporter,
  SimpleSpanProcessor
} from '@opentelemetry/sdk-trace-base'
import type { Layer } from 'effect'
import { config } from '@/services/config.service'

// OTLP HTTP endpoint (otel-lgtm container)
const OTLP_ENDPOINT = 'http://localhost:4318/v1/traces'

console.log('[OTEL] Exporting traces to:', OTLP_ENDPOINT)

export const OtlpLive: Layer.Layer<never> = NodeSdk.layer(() => ({
  resource: {
    serviceName: 'goosebumps-fm-api',
    serviceVersion: process.env.npm_package_version || '1.0.0',
    serviceNamespace: 'application',
    attributes: {
      'deployment.environment': config.app.nodeEnv
    }
  },
  spanProcessor: [
    new SimpleSpanProcessor(new ConsoleSpanExporter()),
    new BatchSpanProcessor(
      new OTLPTraceExporter({
        url: OTLP_ENDPOINT
      })
    )
  ]
}))
