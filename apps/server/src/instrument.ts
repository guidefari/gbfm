import { traceSampleRate } from '@gbfm/core/observability/trace-sampling'
import * as Sentry from '@sentry/bun'
import { Option, Schema } from 'effect'
import { sanitizeDatabaseSpan } from '@/lib/database-telemetry'
import {
  hasLocalSentryContext,
  shouldEnableSentry,
  withoutDatabaseAutoInstrumentation
} from '@/lib/sentry'

const ResourceEntry = Schema.Union([
  Schema.String,
  Schema.Struct({
    value: Schema.optional(Schema.String),
    stage: Schema.optional(Schema.String)
  })
])
const ResourceCollection = Schema.Record(Schema.String, ResourceEntry)
type ResourceCollection = typeof ResourceCollection.Type

let resource: ResourceCollection | undefined
try {
  resource = Option.getOrUndefined(
    Schema.decodeUnknownOption(ResourceCollection)(require('sst').Resource)
  )
} catch {}

function resourceString(name: string, property: string): string | undefined {
  const entry = resource?.[name]
  if (entry === undefined) return undefined
  if (Schema.is(Schema.String)(entry)) return entry
  return property === 'value' ? entry.value : property === 'stage' ? entry.stage : undefined
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
