import { traceSampleRate } from '@gbfm/core/observability/trace-sampling'
import * as Sentry from '@sentry/bun'
import { sanitizeDatabaseSpan } from '@/lib/database-telemetry'
import {
  hasLocalSentryContext,
  shouldEnableSentry,
  withoutDatabaseAutoInstrumentation
} from '@/lib/sentry'

const dsn = process.env.SENTRY_BACKEND_DSN || ''
const environment =
  process.env.SENTRY_ENVIRONMENT ||
  (process.env.NODE_ENV === 'production' ? 'production' : 'development')

const enabled = shouldEnableSentry(dsn, environment)

// Sentry creates the global OpenTelemetry provider before the Effect runtime
// builds its Resource layer. Set the standard resource variables first so
// every exporter (Sentry, Tempo, and Jaeger) receives a named service.
process.env.OTEL_SERVICE_NAME ||= 'goosebumps-fm-api'
process.env.OTEL_RESOURCE_ATTRIBUTES ||= `service.namespace=application,deployment.environment=${encodeURIComponent(environment)}`

if (enabled) {
  Sentry.init({
    dsn,
    environment,
    release: process.env.SENTRY_RELEASE,
    skipOpenTelemetrySetup: true,
    integrations: withoutDatabaseAutoInstrumentation,
    tracesSampler: ({ inheritOrSampleWith, name, normalizedRequest }) =>
      inheritOrSampleWith(traceSampleRate({ name, url: normalizedRequest?.url })),
    sendDefaultPii: false,
    enableLogs: true,
    debug: process.env.SENTRY_DEBUG === 'true',
    beforeSendSpan: sanitizeDatabaseSpan,
    beforeSend: (event) => {
      return hasLocalSentryContext(event) ? null : event
    },
    beforeSendTransaction: (event) => {
      return hasLocalSentryContext(event) ? null : event
    }
  })
}
