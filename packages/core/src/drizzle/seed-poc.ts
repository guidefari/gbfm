import grayMatter from "gray-matter";
import { readdir } from "node:fs/promises";

// const microPostsDir = "./src/archive/micro";
// const postsDir = "./src/archive/words";
// const mixesDir = "./src/archive/mixes";
// const labelsDir = "./src/archive/labels";

const dirs = {
	microPosts: "./src/archive/micro",
	posts: "./src/archive/words",
	mixes: "./src/archive/mixes",
	labels: "./src/archive/labels",
};

// read files by defined folder names

// const files = await readdir("./src/archive", { recursive: true });
const microPosts = await readdir(dirs.microPosts, { recursive: true });
const posts = await readdir(dirs.posts, { recursive: true });
const mixes = await readdir(dirs.mixes, { recursive: true });
const labels = await readdir(dirs.labels, { recursive: true });

// console.log(microPosts);
// console.log(posts);

const readContentsOfFilesInFolder = async (folder: keyof typeof dirs) => {
	const dir = dirs[folder];

	const files = await readdir(dir, { recursive: true });

	const results = await Promise.all(
		files.map(async (file) => {
			const content = await Bun.file(`${dir}/${file}`).text();
			const gray = grayMatter(content);
			const obj = {
				markdown: gray.content,
				frontmatter: gray.data as PostFrontmatter,
			};

			return obj;
		}),
	);

	// console.log(results);
};

readContentsOfFilesInFolder("posts");

interface PostFrontmatter {
	title: string;
	date: string;
	lastmod: string;
	description: string;
	thumbnailUrl: string;
	authors: string[];
	tags: string[];
}
