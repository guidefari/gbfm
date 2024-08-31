export const secret = {
	SpotifyClientId: new sst.Secret(
		"SpotifyClientId",
		process.env.SPOTIFY_CLIENT_ID,
	),
	SpotifyClientSecret: new sst.Secret(
		"SpotifyClientSecret",
		process.env.SPOTIFY_CLIENT_SECRET,
	),
};

export const allSecrets = Object.values(secret);
