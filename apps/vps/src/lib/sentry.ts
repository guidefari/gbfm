import type * as Sentry from '@sentry/bun'

const isLocalUrl = (value: unknown) =>
  typeof value === 'string' && (value.includes('127.0.0.1') || value.includes('localhost'))

/**
 * Local/dev Sentry is opt-in only. Production sends when a DSN is configured;
 * local and development runs must set SENTRY_ENABLED=true explicitly.
 */
export const shouldEnableSentry = (dsn: string, environment: string) =>
  (dsn.length > 0 && environment === 'production') || process.env.SENTRY_ENABLED === 'true'

/**
 * Drops events and transactions created by localhost/dev machines so local
 * testing cannot pollute production Sentry issues, traces, or dashboards.
 */
export const hasLocalSentryContext = (event: Sentry.Event) =>
  isLocalUrl(event.request?.url) ||
  event.server_name === 'Mac.lan' ||
  event.spans?.some((span) => isLocalUrl(span.description) || isLocalUrl(span.data?.url))
