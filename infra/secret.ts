export const secret = {
  SpotifyClientId: new sst.Secret(
    'SpotifyClientId',
    process.env.SPOTIFY_CLIENT_ID
  ),
  SpotifyClientSecret: new sst.Secret(
    'SpotifyClientSecret',
    process.env.SPOTIFY_CLIENT_SECRET
  ),
  DatabaseHost: new sst.Secret('DatabaseHost', process.env.DB_HOST),
  DatabaseUser: new sst.Secret('DatabaseUser', process.env.DB_USER),
  DatabasePassword: new sst.Secret('DatabasePassword', process.env.DB_PASSWORD),
  DatabasePort: new sst.Secret('DatabasePort', process.env.DB_PORT),
  DatabaseName: new sst.Secret('DatabaseName', process.env.DB_NAME),
  SENTRY_DSN: new sst.Secret('SENTRY_DSN', process.env.SENTRY_DSN),
  BETTER_AUTH_SECRET: new sst.Secret(
    'BETTER_AUTH_SECRET',
    process.env.BETTER_AUTH_SECRET
  ),
  BETTER_AUTH_URL: new sst.Secret(
    'BETTER_AUTH_URL',
    process.env.BETTER_AUTH_URL
  )
}

export const allSecrets = Object.values(secret)
