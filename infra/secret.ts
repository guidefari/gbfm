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
  DatabaseName: new sst.Secret('DatabaseName', process.env.DB_NAME)
}

export const allSecrets = Object.values(secret)
