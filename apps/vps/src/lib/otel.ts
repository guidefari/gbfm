import * as Otlp from '@effect/opentelemetry/Otlp'
import * as FetchHttpClient from '@effect/platform/FetchHttpClient'
import { Layer } from 'effect'
import { config } from '@/services/config.service'

const otlpBaseUrl = config.otel.endpoint
const otlpToken = config.otel.token

export const OtlpLive: Layer.Layer<never> = otlpBaseUrl
  ? Otlp.layer({
      baseUrl: otlpBaseUrl,
      resource: {
        serviceName: 'goosebumps-fm-api',
        serviceNamespace: 'application',
        serviceVersion: process.env.npm_package_version || '1.0.0',
        attributes: {
          'deployment.environment':
            config.app.stage === 'prod' ? 'production' : 'development'
        }
      },
      headers: otlpToken ? { Authorization: `Basic ${otlpToken}` } : {},
      metricsExportInterval: '30 seconds',
      tracerExportInterval: '10 seconds',
      loggerExportInterval: '15 seconds'
    }).pipe(Layer.provide(FetchHttpClient.layer))
  : Layer.empty
