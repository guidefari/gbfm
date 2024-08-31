import { z } from "zod";
import querystring from "node:querystring";
import { Resource } from "sst";
import { SpotifyApi as SpotifyApiClient } from "@spotify/web-api-ts-sdk";

const client_id = Resource.SpotifyClientId.value;
const client_secret = Resource.SpotifyClientSecret.value;

const basic = Buffer.from(`${client_id}:${client_secret}`).toString("base64");
const TOKEN_ENDPOINT = "https://accounts.spotify.com/api/token";
const TRACK_DETAILS_ENDPOINT = "https://api.spotify.com/v1/tracks";

export namespace Spotify {
	const client = SpotifyApiClient.withClientCredentials(
		client_id,
		client_secret,
	);

	export const TrackSchema = z.object({
		albumType: z.string().optional(),
		albumImageUrl: z.string().optional(),
		title: z.string().optional(),
		artists: z.string().optional(),
		trackUrl: z.string().optional(),
		previewUrl: z.string().optional(),
	});

	export const getTrack = async (
		id: string,
	): Promise<z.infer<typeof TrackSchema>> => {
		const data = await client.tracks.get(id);

		const sanitizedData: z.infer<typeof TrackSchema> = {
			albumType: data.album?.album_type,
			albumImageUrl: data.album?.images[0]?.url,
			title: data.name,
			artists: data.artists.map((artist) => artist.name).join(", "),
			trackUrl: data.external_urls.spotify,
			previewUrl: data.preview_url ?? undefined,
		};
		return TrackSchema.parse(sanitizedData);
	};
}
