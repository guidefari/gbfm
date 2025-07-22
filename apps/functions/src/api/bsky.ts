import { Hono } from "hono";
import type { PaginationProps } from "@gbfm/core/types";

export namespace BlueskyApi {
	const getAuthorFeedBaseUrl =
		"https://public.api.bsky.app/xrpc/app.bsky.feed.getAuthorFeed";

	// Define the interface for the feed response
	type FeedResponse = {
		cursor: string;
		feed: unknown[];
	};

	export const route = new Hono()
		.get("/", (c) => {
			return c.json({ message: "we blue" }, 200);
		})
		.get("/test", (c) => {
			return c.json({ message: "bluesky test" }, 200);
		})
		.post("/feed", async (c) => {
			type FeedRequest = PaginationProps & {
				actor: string;
			};

			const { actor, page, pageSize } = await c.req.json<FeedRequest>();

			const constructedUrl = new URL(getAuthorFeedBaseUrl);
			actor && constructedUrl.searchParams.set("actor", actor);
			pageSize && constructedUrl.searchParams.set("limit", pageSize.toString());
			page && constructedUrl.searchParams.set("cursor", page.toString());

			const feed = await fetch(constructedUrl.toString()).then(
				(res) => res.json() as Promise<FeedResponse>,
			);
			return c.json(feed);
		});
}
