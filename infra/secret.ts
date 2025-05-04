export const secret = {
  SpotifyClientId: new sst.Secret(
    "SpotifyClientId",
    process.env.SPOTIFY_CLIENT_ID
  ),
  SpotifyClientSecret: new sst.Secret(
    "SpotifyClientSecret",
    process.env.SPOTIFY_CLIENT_SECRET
  ),
  SquealDBUrl: new sst.Secret("SquealDBUrl", process.env.SQUEAL_DB_URL),
  AccessTokenSecret: new sst.Secret("AccessTokenSecret", process.env.ACCESS_TOKEN_SECRET),
  RefreshTokenSecret: new sst.Secret("RefreshTokenSecret", process.env.REFRESH_TOKEN_SECRET),
}

export const allSecrets = Object.values(secret)
