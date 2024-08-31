import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { Result } from "./common";
import { Spotify } from "@gbfm/core/spotify/index";

export namespace SpotifyApi {
	export const route = new OpenAPIHono().openapi(
		createRoute({
			method: "post",
			path: "/track",
			request: {
				body: {
					content: {
						"application/json": {
							schema: z.object({ id: z.string() }),
						},
					},
				},
			},
			responses: {
				200: {
					content: {
						"application/json": {
							schema: Result(Spotify.TrackSchema),
						},
					},
					description: "Returns track details",
				},
			},
		}),
		async (c) => {
			const result = await Spotify.getTrack(c.req.valid("json").id);
			return c.json({ result }, 200);
		},
	);
}
