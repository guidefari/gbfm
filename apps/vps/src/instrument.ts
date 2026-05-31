import * as Sentry from '@sentry/bun'
import { hasLocalSentryContext, shouldEnableSentry } from '@/lib/sentry'

const dsn = process.env.SENTRY_BACKEND_DSN || ''
const environment =
  process.env.SENTRY_ENVIRONMENT ||
  (process.env.NODE_ENV === 'production' ? 'production' : 'development')

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
