import * as Otlp from '@effect/opentelemetry/Otlp'
import * as FetchHttpClient from '@effect/platform/FetchHttpClient'
import { Layer } from 'effect'

const otlpBaseUrl = process.env.OTEL_EXPORTER_OTLP_ENDPOINT
const otlpToken = process.env.GRAFANA_OTLP_TOKEN

export const OtlpLive: Layer.Layer<never> = otlpBaseUrl
  ? Otlp.layer({
      baseUrl: otlpBaseUrl,
      resource: {
        serviceName: 'goosebumps-fm-api',
        serviceVersion: process.env.npm_package_version || '1.0.0',
        attributes: {
          'deployment.environment': process.env.NODE_ENV || 'development'
        }
      },
      headers: otlpToken ? { Authorization: `Basic ${otlpToken}` } : {},
      metricsExportInterval: '30 seconds',
      tracerExportInterval: '10 seconds',
      loggerExportInterval: '15 seconds'
    }).pipe(Layer.provide(FetchHttpClient.layer))
  : Layer.empty
