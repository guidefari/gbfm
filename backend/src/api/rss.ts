import { Hono } from "hono";
import { Resource } from "sst";
import { DynamoWrapper } from "@gbfm/core/util/dynamo.wrapper.ts";
import { Atom } from "@feed/feed";

export namespace RssApi {
	export const route = new Hono().get("/", async (c) => {
		try {
			const content = await DynamoWrapper.listByPrefix(
				Resource.ContentTable.name,
				"mix",
			);

			const latestUpdated: Date = new Date("2018-07-11T22:00:00.000Z");

			const atomFeed = new Atom({
				title: "Goosebumps.fm Mixes",
				description: "Curated mixes from the Goosebumps.fm archive",
				link: "https://api.goosebumps.fm/rss",
				authors: [
					{
						name: "Guide Fari",
						email: "guidefari@icloud.com",
					},
				],
				// updated: latestUpdated,
				id: "https://api.goosebumps.fm/rss",
			});

			for (const item of content) {
				const date = new Date((item.updatedAt || item.createdAt) * 1000);

				if (date > latestUpdated) {
					atomFeed.updated = date;
				}

				atomFeed.addItem({
					title: item.title || item.contentId,
					link: item.mp3Url,
					id: item.contentId,
					updated: date,
					summary: item.description,
					content: {
						body: item.content || item.description || "",
						type: "text",
					},
				});
			}

			return c.text(atomFeed.build(), 200, {
				"Content-Type": "application/rss+xml",
			});
		} catch (error) {
			console.error("Error generating RSS feed:", error);
			return c.text("Internal Server Error", 500);
		}
	});
}
