import { Hono } from "hono";
import { Resource } from "sst";
import { DynamoWrapper } from "@gbfm/core/util/dynamo.wrapper.ts";

export namespace RssApi {
	export const route = new Hono().get("/", async (c) => {
		try {
			const content = await DynamoWrapper.listByPrefix(
				Resource.ContentTable.name,
				"mix",
			);

			const DEFAULT_IMAGE_URL = 'https://d20tmfka7s58bt.cloudfront.net/gb-default.png'
			const sortedContent = content.sort((a, b) => b.updatedAt - a.updatedAt);
			console.log('sortedContent:', sortedContent[0])
			const latestUpdated = new Date((sortedContent[0].updatedAt * 1000 || sortedContent[0].createdAt * 1000) + (2 * 60 * 60 * 1000));


			const mixesRSSified = await Promise.all(
				sortedContent.map(async (mix) => {
					const url = `${mix.url}`;
					const { headers } = await fetch(mix.mp3Url);
					const contentLength = headers.get("content-length");
					const date = new Date((mix.updatedAt * 1000 || mix.createdAt * 1000) + (2 * 60 * 60 * 1000));
	
					return `<item>
							<title>${mix.title}</title>
							<link>https://goosebumps.fm/read/mixes/${mix.slug}</link>
							<guid>${mix.mp3Url}</guid>
							<enclosure url="${mix.mp3Url}" type="audio/mpeg" length="${contentLength}"/>
							<pubDate>${date.toUTCString()}</pubDate>
							${
											mix.description
												? `<description>${encodeXML(mix.description)}. Get the tracklist and more a immersive experience over at ${url}</description>`
												: ""
										}
							<itunes:image href="${mix.thumbnailUrl ?? DEFAULT_IMAGE_URL}"/>
							<itunes:subtitle>${mix.title}</itunes:subtitle>
							<itunes:summary>${encodeXML(mix.description ?? `${mix.title} by ${mix.author}`)}</itunes:summary>
							${mix.genres ? `<itunes:keywords>${mix.genres.join(", ")}</itunes:keywords>` : ""}
							<itunes:author>Guide Fari</itunes:author>
							<dc:creator>Guide Fari</dc:creator>
							<itunes:explicit>no</itunes:explicit>
							</item>`;
					}),
			);

			const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
					<rss xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:atom="http://www.w3.org/2005/Atom" version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd">
					<channel>
					<title>Goosebumps.fm Mixes</title>
					<description>Curated mixes from the Goosebumps.fm archive</description>
					<link>https://goosebumps.fm/rss</link>
					<lastBuildDate>${latestUpdated.toUTCString()}</lastBuildDate>
					<image>
					<url>${DEFAULT_IMAGE_URL}</url>
					<title>goosebumps.fm</title>
					<link>${DEFAULT_IMAGE_URL}</link>
					<width>400</width>
					<height>400</height>
					</image>
				<itunes:image href="${DEFAULT_IMAGE_URL}"/>
				<itunes:category text="Music"/>
				<language>en-gb</language>
				<itunes:explicit>false</itunes:explicit>
					${mixesRSSified.join("")}
				</channel>
				</rss>`;

			return c.text(sitemap, 200, {
				"Content-Type": "text/xml",
			});
		} catch (error) {
			console.error("Error generating RSS feed:", error);
			return c.text("Internal Server Error", 500);
		}
	});
}

const encodeXML = (str: string) =>
	str
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&apos;");
