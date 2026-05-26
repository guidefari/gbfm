import * as Sentry from '@sentry/bun'

const dsn = process.env.SENTRY_BACKEND_DSN || ''
const environment =
  process.env.SENTRY_ENVIRONMENT ||
  (process.env.NODE_ENV === 'production' ? 'production' : 'development')

if (dsn) {
  Sentry.init({
    dsn,
    environment,
    release: process.env.SENTRY_RELEASE,
    tracesSampleRate: 1.0,
    sendDefaultPii: false,
    enableLogs: true,
    debug: process.env.SENTRY_DEBUG === 'true'
  })
}
