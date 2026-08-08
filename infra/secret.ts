export const secret = {
  SpotifyClientId: new sst.Secret('SpotifyClientId'),
  SpotifyClientSecret: new sst.Secret('SpotifyClientSecret'),
  DatabaseHost: new sst.Secret('DatabaseHost'),
  DatabaseUser: new sst.Secret('DatabaseUser'),
  DatabasePassword: new sst.Secret('DatabasePassword'),
  DatabasePort: new sst.Secret('DatabasePort'),
  DatabaseName: new sst.Secret('DatabaseName'),
  SENTRY_BACKEND_DSN: new sst.Secret('SENTRY_BACKEND_DSN'),
  VITE_PUBLIC_SENTRY_DSN: new sst.Secret('VITE_PUBLIC_SENTRY_DSN'),
  OTEL_EXPORTER_OTLP_ENDPOINT: new sst.Secret('OTEL_EXPORTER_OTLP_ENDPOINT'),
  OTEL_EXPORTER_OTLP_HEADERS: new sst.Secret('OTEL_EXPORTER_OTLP_HEADERS'),
  BETTER_AUTH_SECRET: new sst.Secret('BETTER_AUTH_SECRET'),
  BETTER_AUTH_URL: new sst.Secret('BETTER_AUTH_URL'),
  GBFM_ENCRYPTION_ROOT_KEY: new sst.Secret('GBFM_ENCRYPTION_ROOT_KEY'),
  StorageProvider: new sst.Secret('StorageProvider', 'aws'),
  StorageEndpoint: new sst.Secret('StorageEndpoint', ''),
  StorageRegion: new sst.Secret('StorageRegion', 'auto'),
  StorageAccessKeyId: new sst.Secret('StorageAccessKeyId', ''),
  StorageSecretAccessKey: new sst.Secret('StorageSecretAccessKey', ''),
  StorageSigningEndpoint: new sst.Secret('StorageSigningEndpoint', '')
}

export const allSecrets = Object.values(secret)
