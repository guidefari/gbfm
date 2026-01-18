import * as NodeSdk from '@effect/opentelemetry/NodeSdk'
import {
  ConsoleSpanExporter,
  SimpleSpanProcessor
} from '@opentelemetry/sdk-trace-base'

// Create the tracing layer using Effect's OTEL integration
export const NodeSdkLive = NodeSdk.layer(() => ({
  resource: {
    serviceName: 'goosebumps-fm-api',
    serviceVersion: '1.0.0'
  },
  // Console exporter for development
  spanProcessor: new SimpleSpanProcessor(new ConsoleSpanExporter())
}))
