import type { NextApiRequest, NextApiResponse } from "next";
import { getSession } from "next-auth/react";
import type { PlaylistInput, PlaylistResponse } from "@/types";
import { getUsersPlaylists } from "@/lib/spotify";
import { Session } from "next-auth";

export type ResponseType = PlaylistResponse["items"] | { error: string }; // Updated response type

let playlists: PlaylistResponse["items"] = []; // Ensure playlists is always an array
let looping = true;

const handler = async (
	req: NextApiRequest,
	res: NextApiResponse<ResponseType>,
) => {
	const session = await getSession({ req });
	if (!session || !session.token) {
		return res.status(401).json({ error: "Unauthorized" });
	}

	const { accessToken, sub } = session.token;

	playlists = [];

	await getBatch({ refresh_token: accessToken, user_id: sub });

	if (!looping) {
		// const random = stringsss[Math.floor(Math.random() * stringsss.length)]
		return res.status(200).send(playlists);
	}
};

export default handler;

const getBatch = async ({
	offset,
	refresh_token,
	user_id,
	next_url,
}: PlaylistInput): Promise<void> => {
	const response = await getUsersPlaylists({
		refresh_token,
		user_id,
		offset,
		next_url,
	});
	const thing: PlaylistResponse = await response.json();
	// const stuffToClean:  = await response.json()
	// const clean = await cleanShitUp(stuffToClean)
	playlists.push(...thing.items);
	if (thing.next) {
		await getBatch({ refresh_token, user_id, next_url: thing.next });
	}

	looping = false;
};

// const cleanShitUp = async (stuff: PlaylistResponse) => {
//   console.log('stuff:', stuff)
//   return stuff.items.map((item) => item.external_urls.spotify)
// }
