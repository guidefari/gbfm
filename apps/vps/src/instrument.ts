import { isRecord } from '@gbfm/core/utils'
import * as Sentry from '@sentry/bun'
import { hasLocalSentryContext, shouldEnableSentry } from '@/lib/sentry'

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

if (enabled) {
  Sentry.init({
    dsn,
    environment,
    release: process.env.SENTRY_RELEASE,
    tracesSampleRate: 1.0,
    sendDefaultPii: false,
    enableLogs: true,
    debug: process.env.SENTRY_DEBUG === 'true',
    beforeSend: (event) => {
      return hasLocalSentryContext(event) ? null : event
    },
    beforeSendTransaction: (event) => {
      return hasLocalSentryContext(event) ? null : event
    }
  })

  console.warn(`[sentry] preload init env=${environment} traces=1`)
}
