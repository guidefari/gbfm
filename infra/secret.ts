export const secret = {
  SpotifyClientId: new sst.Secret(
    'SpotifyClientId',
    process.env.SPOTIFY_CLIENT_ID
  ),
  SpotifyClientSecret: new sst.Secret(
    'SpotifyClientSecret',
    process.env.SPOTIFY_CLIENT_SECRET
  ),
  AccessTokenSecret: new sst.Secret(
    'ACCESS_TOKEN_SECRET',
    process.env.ACCESS_TOKEN_SECRET
  ),
  RefreshTokenSecret: new sst.Secret(
    'REFRESH_TOKEN_SECRET',
    process.env.REFRESH_TOKEN_SECRET
  ),
  DatabaseHost: new sst.Secret('DatabaseHost', process.env.DB_HOST),
  DatabaseUser: new sst.Secret('DatabaseUser', process.env.DB_USER),
  DatabasePassword: new sst.Secret('DatabasePassword', process.env.DB_PASSWORD),
  DatabasePort: new sst.Secret('DatabasePort', process.env.DB_PORT),
  DatabaseName: new sst.Secret('DatabaseName', process.env.DB_NAME),
  POSTHOG_KEY: new sst.Secret('POSTHOG_KEY', process.env.POSTHOG_KEY),
  POSTHOG_HOST: new sst.Secret('POSTHOG_HOST', process.env.POSTHOG_HOST),
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
