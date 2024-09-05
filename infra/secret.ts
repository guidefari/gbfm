export const secret = {
	SpotifyClientId: new sst.Secret("SpotifyClientId"),
	SpotifyClientSecret: new sst.Secret("SpotifyClientSecret"),
};

export const allSecrets = Object.values(secret);
