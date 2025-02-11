import { createID } from "@/util/id";
import grayMatter from "gray-matter";
import { readdir } from "node:fs/promises";
import { MicroPost } from "@/microPost";
import { Resource } from "sst/resource";
import { log } from "node:console";
import type {ContentPrefixes} from '../util/id'

// type ArchiveDirectoryKeys = Omit<ContentPrefixes, "">

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
	const dir = dirs[folder];
	log({dir})

	const files = await readdir(dir, { recursive: true });

	const results = await Promise.all(
		files.map(async (file) => {
			const content = await Bun.file(`${dir}/${file}`).text();
			const gray = grayMatter(content);
			const obj = {
				title: gray.data.title,
				contentId: createID(folder),
				content: gray.content,
				createdAt: new Date(gray.data.date).getTime() / 1000,
				updatedAt: new Date(gray.data.lastmod || gray.data.date).getTime() / 1000,
				authorId: "usr_6ehHmLSaGyn3Hq9z",
				description: gray.data.description,
				tags: gray.data.tags,
				// genres: gray.data.genres,
				// mp3Url: gray.data.mp3Url,
				// youtubeId: gray.data.youtubeId,
				slug: file.replace(".mdx", ""),
				thumbnailUrl: gray.data.thumbnailUrl,
				draft: gray.data.draft,
			};

			MicroPost.MicroPostSchema.parse(obj);

			return obj;
		}),
	);

	return results;
};

const content = await readContentsOfFilesInFolder("post");
log(content[1])
await Bun.write(
	"./src/archive/sample-post.json",
	JSON.stringify(content[1], null, 2)
  );
// const writeToLocal = await Bun.write(
// 	"./src/archive/micro.json",
// 	JSON.stringify(readMicro, null, 2),
// );
// const apiUrl = "https://api.local.staging.goosebumps.fm/content/seed";
const apiUrl = "https://api.goosebumps.fm/content/seed";

try {
	const res = await fetch(apiUrl, {
		method: "POST",
		body: JSON.stringify(content),
	});
	console.log("res:", res);
} catch (error) {
	console.error("error:", error);
}
