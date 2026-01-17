/**
 * OpenTelemetry Initialization (Vendor-Neutral)
 *
 * This file sets up OpenTelemetry with a vendor-neutral approach.
 * You can send telemetry to any backend by configuring the OTEL Collector.
 *
 * Supported backends:
 * - Jaeger (self-hosted)
 * - Honeycomb
 * - Grafana Cloud
 * - New Relic
 * - Datadog
 * - Any OTLP-compatible backend
 */

import { NodeSDK } from '@opentelemetry/sdk-node'
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node'
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http'
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http'
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics'
import { Resource } from '@opentelemetry/resources'
import {
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
  ATTR_DEPLOYMENT_ENVIRONMENT
} from '@opentelemetry/semantic-conventions'
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base'
import { diag, DiagConsoleLogger, DiagLogLevel } from '@opentelemetry/api'

// Enable diagnostic logging in development
if (process.env.NODE_ENV !== 'production') {
  diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.INFO)
}

/**
 * Configure the OTLP endpoint
 *
 * Priority:
 * 1. OTEL_EXPORTER_OTLP_ENDPOINT environment variable
 * 2. Service discovery endpoint (otel-collector.local:4318)
 * 3. Fallback to localhost for local development
 */
function getOTLPEndpoint(): string {
  // Check if explicit endpoint is set
  if (process.env.OTEL_EXPORTER_OTLP_ENDPOINT) {
    return process.env.OTEL_EXPORTER_OTLP_ENDPOINT
  }

  // Use service discovery in ECS
  if (process.env.ECS_CONTAINER_METADATA_URI_V4) {
    return 'http://otel-collector.local:4318'
  }

  // Local development
  return 'http://localhost:4318'
}

/**
 * Create resource with service information
 */
function createResource(): Resource {
  return new Resource({
    [ATTR_SERVICE_NAME]: process.env.OTEL_SERVICE_NAME || 'gbfm-vps',
    [ATTR_SERVICE_VERSION]: process.env.APP_VERSION || '1.0.0',
    [ATTR_DEPLOYMENT_ENVIRONMENT]: process.env.DEPLOYMENT_ENVIRONMENT || 'development',
    'service.namespace': 'gbfm',
    'cloud.provider': 'aws',
    'cloud.platform': 'aws_ecs',
  })
}

/**
 * Initialize OpenTelemetry SDK
 *
 * This sets up:
 * - Automatic instrumentation for HTTP, PostgreSQL, AWS SDK, etc.
 * - Trace exporter via OTLP
 * - Metrics exporter via OTLP
 * - Resource detection
 */
export function initializeTelemetry(): NodeSDK | null {
  // Skip initialization if explicitly disabled
  if (process.env.OTEL_SDK_DISABLED === 'true') {
    console.log('OpenTelemetry SDK is disabled')
    return null
  }

  const otlpEndpoint = getOTLPEndpoint()
  console.log(`🔭 Initializing OpenTelemetry with endpoint: ${otlpEndpoint}`)

  // Configure trace exporter
  const traceExporter = new OTLPTraceExporter({
    url: `${otlpEndpoint}/v1/traces`,
    headers: {
      // Add custom headers if needed (e.g., API keys)
      // These will be overridden by the OTEL Collector if configured
      ...(process.env.OTEL_EXPORTER_OTLP_HEADERS
        ? JSON.parse(process.env.OTEL_EXPORTER_OTLP_HEADERS)
        : {})
    }
  })

  // Configure metrics exporter
  const metricExporter = new OTLPMetricExporter({
    url: `${otlpEndpoint}/v1/metrics`,
    headers: {
      ...(process.env.OTEL_EXPORTER_OTLP_HEADERS
        ? JSON.parse(process.env.OTEL_EXPORTER_OTLP_HEADERS)
        : {})
    }
  })

  // Create SDK configuration
  const sdk = new NodeSDK({
    resource: createResource(),

    // Trace configuration
    spanProcessor: new BatchSpanProcessor(traceExporter, {
      maxQueueSize: 2048,
      maxExportBatchSize: 512,
      scheduledDelayMillis: 5000,
      exportTimeoutMillis: 30000
    }),

    // Metrics configuration
    metricReader: new PeriodicExportingMetricReader({
      exporter: metricExporter,
      exportIntervalMillis: 60000 // Export every 60 seconds
    }),

    // Automatic instrumentation
    instrumentations: [
      getNodeAutoInstrumentations({
        // HTTP instrumentation
        '@opentelemetry/instrumentation-http': {
          enabled: true,
          ignoreIncomingRequestHook: (req) => {
            // Don't trace health checks
            const url = req.url || ''
            return url.includes('/health') || url.includes('/favicon.ico')
          },
          // Add custom attributes to HTTP spans
          requestHook: (span, request) => {
            span.setAttribute('http.client_ip', request.headers['x-forwarded-for'] || 'unknown')
          }
        },

        // PostgreSQL instrumentation
        '@opentelemetry/instrumentation-pg': {
          enabled: true,
          // Capture query parameters (be careful with PII!)
          enhancedDatabaseReporting: process.env.NODE_ENV !== 'production'
        },

        // AWS SDK instrumentation
        '@opentelemetry/instrumentation-aws-sdk': {
          enabled: true,
          suppressInternalInstrumentation: true
        },

        // DNS instrumentation
        '@opentelemetry/instrumentation-dns': {
          enabled: true
        },

        // Net instrumentation
        '@opentelemetry/instrumentation-net': {
          enabled: true
        },

        // Disable noisy instrumentations
        '@opentelemetry/instrumentation-fs': {
          enabled: false
        }
      })
    ]
  })

  // Start the SDK
  try {
    sdk.start()
    console.log('✅ OpenTelemetry initialized successfully')

    // Graceful shutdown on process termination
    process.on('SIGTERM', () => {
      sdk
        .shutdown()
        .then(() => console.log('OpenTelemetry SDK shut down successfully'))
        .catch((error) => console.error('Error shutting down OpenTelemetry SDK', error))
        .finally(() => process.exit(0))
    })

    return sdk
  } catch (error) {
    console.error('Failed to initialize OpenTelemetry:', error)
    return null
  }
}

/**
 * Get tracer for manual instrumentation
 *
 * Usage:
 * ```ts
 * import { getTracer } from './lib/telemetry/init'
 *
 * const tracer = getTracer()
 * const span = tracer.startSpan('operation-name')
 * // ... do work
 * span.end()
 * ```
 */
export function getTracer(name = 'gbfm-vps') {
  const { trace } = require('@opentelemetry/api')
  return trace.getTracer(name)
}

/**
 * Get meter for custom metrics
 *
 * Usage:
 * ```ts
 * import { getMeter } from './lib/telemetry/init'
 *
 * const meter = getMeter()
 * const counter = meter.createCounter('http.requests')
 * counter.add(1, { method: 'GET', route: '/api/users' })
 * ```
 */
export function getMeter(name = 'gbfm-vps') {
  const { metrics } = require('@opentelemetry/api')
  return metrics.getMeter(name)
}
