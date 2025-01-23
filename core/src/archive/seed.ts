import { createID } from "@/util/id";
import grayMatter from "gray-matter";
import { readdir } from "node:fs/promises";
import { MicroPost } from "@/microPost";
import { Resource } from "sst/resource";
// const microPostsDir = "./src/archive/micro";
// const postsDir = "./src/archive/words";
// const mixesDir = "./src/archive/mixes";
// const labelsDir = "./src/archive/labels";

const dirs = {
	micro: "./src/archive/micro",
	posts: "./src/archive/words",
	mixes: "./src/archive/mixes",
	labels: "./src/archive/labels",
};

// read files by defined folder names

// const files = await readdir("./src/archive", { recursive: true });
const microPosts = await readdir(dirs.micro, { recursive: true });
const posts = await readdir(dirs.posts, { recursive: true });
const mixes = await readdir(dirs.mixes, { recursive: true });
const labels = await readdir(dirs.labels, { recursive: true });

// console.log(microPosts);
// console.log(posts);

export const readContentsOfFilesInFolder = async (
	folder: keyof typeof dirs,
) => {
	const dir = dirs[folder];

	const files = await readdir(dir, { recursive: true });

	const results = await Promise.all(
		files.map(async (file) => {
			const content = await Bun.file(`${dir}/${file}`).text();
			const gray = grayMatter(content);
			const obj = {
				title: gray.data.title,
				contentId: createID("mix"),
				content: gray.content,
				createdAt: new Date(gray.data.date).getTime() / 1000,
				updatedAt: new Date(gray.data.date).getTime() / 1000,
				authorId: "usr_6ehHmLSaGyn3Hq9z",
				description: gray.data.description,
				genres: gray.data.genres,
				mp3Url: gray.data.mp3Url,
				youtubeId: gray.data.youtubeId,
				slug: file.replace(".mdx", ""),
			};

			// MicroPost.MicroPostSchema.parse(obj);

			return obj;
		}),
	);

	return results;
};

const readMixes = await readContentsOfFilesInFolder("mixes");
// const writeToLocal = await Bun.write(
// 	"./src/archive/micro.json",
// 	JSON.stringify(readMicro, null, 2),
// );
// console.log("readMicro:", readMicro);
// const apiUrl = "https://api.goosebumps.fm/micro-posts/seed";
// const apiUrl = "https://api.local.staging.goosebumps.fm/content/seed";
const prodApiUrl = "https://api.goosebumps.fm/content/seed";

try {
	const res = await fetch(prodApiUrl, {
		method: "POST",
		body: JSON.stringify(readMixes),
	});
	console.log("res:", res);
} catch (error) {
	console.error("error:", error);
}


interface PostFrontmatter {
	title: string;
	date: string;
	lastmod: string;
	description: string;
	thumbnailUrl: string;
	authors: string[];
	tags: string[];
}
