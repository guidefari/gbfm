import { isRecord } from '@gbfm/core/utils'
import { traceSampleRate } from '@gbfm/core/observability/trace-sampling'
import * as Sentry from '@sentry/bun'
import { sanitizeDatabaseSpan } from '@/lib/database-telemetry'
import {
  hasLocalSentryContext,
  shouldEnableSentry,
  withoutDatabaseAutoInstrumentation
} from '@/lib/sentry'

let resource: Record<string, unknown> | undefined
try {
  const sst = require('sst')
  if (isRecord(sst) && isRecord(sst.Resource)) resource = sst.Resource
} catch {}

function resourceString(name: string, property: string): string | undefined {
  const entry = resource?.[name]
  if (!isRecord(entry)) return typeof entry === 'string' ? entry : undefined
  const value = entry[property]
  return typeof value === 'string' ? value : undefined
}

const appStage = resourceString('App', 'stage')

const dsn = resourceString('SENTRY_BACKEND_DSN', 'value') || process.env.SENTRY_BACKEND_DSN || ''
const environment =
  process.env.SENTRY_ENVIRONMENT ||
  (appStage === 'prod'
    ? 'production'
    : process.env.NODE_ENV === 'production'
      ? 'production'
      : 'development')

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
