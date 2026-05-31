export const env = {
  isDev: import.meta.env.DEV,
  spotifyClientId: import.meta.env.VITE_SPOTIFY_CLIENT_ID,
  sentryDsn: import.meta.env.VITE_PUBLIC_SENTRY_DSN,
  /** Local frontend Sentry is opt-in to keep dev traces out of prod dashboards. */
  sentryEnableLocal: import.meta.env.VITE_PUBLIC_SENTRY_ENABLE_LOCAL === 'true',
  sentryEnvironment: import.meta.env.VITE_PUBLIC_SENTRY_ENVIRONMENT,
  sentryRelease: import.meta.env.VITE_PUBLIC_SENTRY_RELEASE as string | undefined
}
