import type {
	AlbumApiResponse,
	GenericAndMaybeLegacyError,
	TrackAPIResponse,
} from "@/types";
import type { NextApiRequest, NextApiResponse } from "next";
import { getAlbumDetails } from "../../lib/spotify";
import * as Sentry from "@sentry/nextjs";

const { parse } = require("spotify-uri");

// eslint-disable-next-line import/no-anonymous-default-export
export default async (
	req: NextApiRequest,
	res: NextApiResponse<AlbumApiResponse | GenericAndMaybeLegacyError>,
) => {
	const { query } = req;
	let id;

	try {
		const isLink = !!new URL(query?.id as string);
		const item = parse(query?.id);
		id = item.id;
	} catch (error) {
		id = query?.id;
	}

	try {
		const response = await getAlbumDetails(id);

		if (response.status > 400) {
			return res.status(response.status).json({ error: "Album Not Found" });
		}

		const albumType = response.album_type;
		const albumImageUrl = response.images[0].url;
		const title = response.name;
		const artists = response.artists.map((_artist) => _artist.name).join(", ");
		const albumUrl = response.external_urls.spotify;

		const number_of_tracks_in_album = response.tracks.items.length;
		const preview_url_track_number = randomNumberWithinRange(
			0,
			number_of_tracks_in_album - 1,
		);
		const previewUrl =
			response.tracks.items[preview_url_track_number].preview_url;
		const tracks: TrackAPIResponse[] = response.tracks.items.map(
			(item): TrackAPIResponse => ({
				artists: item.artists.map((_artist) => _artist.name).join(", "),
				previewUrl: item.preview_url,
				title: item.name,
				trackUrl: item.external_urls.spotify,
				albumImageUrl,
			}),
		);

		return res.status(200).json({
			tracks,
			albumType,
			albumImageUrl,
			title,
			artists,
			albumUrl,
			previewUrl,
		});
	} catch (error) {
		Sentry.captureException(error);
		return res.status(500).json({ error: "Internal Server Error" });
	}
};

function randomNumberWithinRange(myMin, myMax) {
	return Math.floor(Math.random() * (myMax - myMin + 1) + myMin);
}
