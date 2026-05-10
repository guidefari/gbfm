export const env = {
  isDev: import.meta.env.DEV,
  spotifyClientId: import.meta.env.VITE_SPOTIFY_CLIENT_ID,
  sentryDsn: import.meta.env.VITE_PUBLIC_SENTRY_DSN,
  sentryEnvironment: import.meta.env.VITE_PUBLIC_SENTRY_ENVIRONMENT
}
