import type * as Sentry from '@sentry/core'

const DATABASE_AUTO_INTEGRATIONS = new Set(['Postgres', 'PostgresJs'])

const isLocalUrl = (value: unknown) =>
  typeof value === 'string' && (value.includes('127.0.0.1') || value.includes('localhost'))

/**
 * Database queries use the explicit client wrapper so raw SQL never enters telemetry.
 * Sentry's automatic integrations would create a second span containing the statement.
 */
export const withoutDatabaseAutoInstrumentation = <T extends { readonly name: string }>(
  integrations: T[]
) => integrations.filter((integration) => !DATABASE_AUTO_INTEGRATIONS.has(integration.name))

/**
 * Local/dev Sentry is opt-in only. Production sends when a DSN is configured;
 * local and development runs must set SENTRY_ENABLED=true explicitly.
 */
export const shouldEnableSentry = (dsn: string, environment: string, forceEnabled = false) =>
  (dsn.length > 0 && environment === 'production') || forceEnabled

/**
 * Drops events and transactions created by localhost/dev machines so local
 * testing cannot pollute production Sentry issues, traces, or dashboards.
 */
export const hasLocalSentryContext = (event: Sentry.Event) =>
  isLocalUrl(event.request?.url) ||
  event.server_name === 'Mac.lan' ||
  event.spans?.some((span) => isLocalUrl(span.description) || isLocalUrl(span.data?.url))
