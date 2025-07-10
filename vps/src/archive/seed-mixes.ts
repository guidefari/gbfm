import { log } from "node:console";
import { readdir } from "node:fs/promises";
import path from "node:path";
import type { ContentPrefixes } from "@gbfm/core/util/id";
import { type InsertMix, InsertMixSchema } from "@gbfm/vps/schemas";
import grayMatter from "gray-matter";

const fallbackThumbnailUrl =
	"https://d20tmfka7s58bt.cloudfront.net/gb-default.png";

const dirs: Record<ContentPrefixes, string> = {
	microPost: "./src/archive/micro",
	post: "./src/archive/words",
	mix: "./src/archive/mixes",
	label: "./src/archive/labels",
	user: "./src/archive/authors",
};

export const readContentsOfFilesInFolder = async (
	folder: keyof typeof dirs,
) => {
	// const dir = dirs[folder];
	const dir = path.join(process.cwd(), dirs[folder]);
	log({ dir });

	const files = await readdir(dir, { recursive: true });

	const results = await Promise.all(
		files.map(async (file) => {
			const content = await Bun.file(`${dir}/${file}`).text();
			const gray = grayMatter(content);
			const obj: InsertMix = {
				title: gray.data.title,
				// id: createID("mix"),
				content: gray.content,
				// createdAt: new Date(gray.data.date).getTime(),
				// updatedAt: new Date(gray.data.lastmod || gray.data.date).getTime(),
				// authorId: gray.data.authors?.[0] ?? "usr_6ehHmLSaGyn3Hq9z",
				description: gray.data.description,
				tags: gray.data.tags,
				slug: file.replace(".mdx", ""),
				thumbnailUrl: gray.data.thumbnailUrl || fallbackThumbnailUrl,
				draft: gray.data.draft || false,
				url: gray.data.mp3Url,
			};

			console.log(obj);

			InsertMixSchema.parse(obj);

			return obj;
		}),
	);

	return results;
};

export const parsedMixes = await readContentsOfFilesInFolder("mix");

// const apiUrl = "https://api.goosebumps.fm/content/seed";

// try {
// 	const res = await fetch(apiUrl, {
// 		method: "POST",
// 		body: JSON.stringify(content),
// 	});
// 	console.log("res:", res);
// } catch (error) {
// 	console.error("error:", error);
// }
