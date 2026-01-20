import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http'
import { resourceFromAttributes } from '@opentelemetry/resources'
import {
  BatchSpanProcessor,
  ConsoleSpanExporter,
  SimpleSpanProcessor,
  TraceIdRatioBasedSampler
} from '@opentelemetry/sdk-trace-base'
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node'

const isProduction = process.env.NODE_ENV === 'production'
const otelExporterUrl = process.env.OTEL_EXPORTER_OTLP_ENDPOINT

const createSpanProcessor = () => {
  if (otelExporterUrl) {
    return new BatchSpanProcessor(
      new OTLPTraceExporter({
        url: `${otelExporterUrl}/v1/traces`
      })
    )
  }
  return new SimpleSpanProcessor(new ConsoleSpanExporter())
}

const sampleRate = Number.parseFloat(
  process.env.OTEL_SAMPLING_RATE || (isProduction ? '0.1' : '1.0')
)

const resource = resourceFromAttributes({
  'service.name': 'goosebumps-fm-api',
  'service.version': process.env.npm_package_version || '1.0.0',
  'deployment.environment': process.env.NODE_ENV || 'development'
})

const provider = new NodeTracerProvider({
  resource,
  sampler: new TraceIdRatioBasedSampler(sampleRate),
  spanProcessors: [createSpanProcessor()]
})

provider.register()

export const shutdownTracing = () => provider.shutdown()
