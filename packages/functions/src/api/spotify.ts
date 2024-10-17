import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { Result } from "./common";
import { SpotifyHttp, SpotifyProxyTypes } from "@gbfm/core/spotify/index";
import { cors } from "hono/cors";
import { Resource } from "sst";
import { csrf } from "hono/csrf";

export namespace SpotifyApi {
	export const route = new OpenAPIHono()
		.openapi(
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
								schema: SpotifyProxyTypes.TrackSchema,
							},
						},
						description: "Returns track details",
					},
					404: {
						description: "Track not found",
					},
				},
			}),
			async (c) => {
				try {
					const { id } = await c.req.json();
					const result = await SpotifyHttp.getTrack(id);
					return c.json({ ...result }, 200);
				} catch (error) {
					if (error instanceof Error) {
						return c.json({ error: error.message }, 404);
					}
					return c.json({ error: "An unknown error occurred" }, 500);
				}
			},
		)
		.openapi(
			createRoute({
				method: "post",
				path: "/album",
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
								schema: SpotifyProxyTypes.AlbumSchema,
							},
						},
						description: "Returns album details",
					},
					404: {
						description: "Album not found",
					},
				},
			}),
			async (c) => {
				try {
					const { id } = await c.req.json();
					const result = await SpotifyHttp.getAlbum(id);
					return c.json({ ...result }, 200);
				} catch (error) {
					if (error instanceof Error) {
						return c.json({ error: error.message }, 404);
					}
					return c.json({ error: "An unknown error occurred" }, 500);
				}
			},
		)
		.openapi(
			createRoute({
				method: "post",
				path: "/playlist",
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
								schema: SpotifyProxyTypes.PlaylistSchema,
							},
						},
						description: "Returns playlist details",
					},
					404: {
						description: "Playlist not found",
					},
				},
			}),
			async (c) => {
				try {
					const { id } = await c.req.json();

					const result = await SpotifyHttp.getPlaylist(id);
					return c.json({ ...result }, 200);
				} catch (error) {
					if (error instanceof Error) {
						return c.json({ error: error.message }, 404);
					}
					return c.json({ error: "An unknown error occurred" }, 500);
				}
			},
		);

	// .use(
	// 	csrf({
	// 		origin: ["https://example.fm"],
	// 	}),
	// );
	// .openapi() //album
	// .openapi() //artist
	// .openapi() //playlist
}
