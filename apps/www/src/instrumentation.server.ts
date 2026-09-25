import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http'
import { resourceFromAttributes } from '@opentelemetry/resources'
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base'
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node'

if (process.env.NODE_ENV !== 'production') {
  const provider = new NodeTracerProvider({
    resource: resourceFromAttributes({ 'service.name': 'goosebumps-fm-www' }),
    spanProcessors: [
      new BatchSpanProcessor(new OTLPTraceExporter({ url: 'http://127.0.0.1:4318/v1/traces' }), {
        scheduledDelayMillis: 250
      })
    ]
  })
  provider.register()
}
