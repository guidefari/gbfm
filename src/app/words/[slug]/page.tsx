import { LongPost } from "@/components/Layout/LongPost";
import { DEFAULT_IMAGE_URL } from "@/constants";
import { allPosts } from "@/contentlayer/generated";
import type { Metadata } from "next";
import matter from "gray-matter";
import fs from "node:fs";

export async function generateStaticParams() {
	const paths: string[] = allPosts.map((post) => post.url);

	return paths.map((path) => ({
		slug: path,
	}));
}

type Params = {
	params: { slug: string };
};

export async function generateMetadata({ params }: Params): Promise<Metadata> {
	const { slug } = params;
	// const post = allPosts.find(
	// 	(singlePost) => singlePost._raw.flattenedPath === `words/${slug}`,
	// );

	// readdir, get the file from `src/content/words/${slug}.mdx`
	const file = fs.readFileSync(`src/content/words/${slug}.mdx`, "utf8");
	const post = matter(file);

	if (!post) {
		return {
			title: "Post not found",
		};
	}
	return {
		title: post.data.title,
		description: post.data.description,
		openGraph: {
			images: [post.data.thumbnailUrl ?? DEFAULT_IMAGE_URL],
		},
	};
}

export default function PostPage({ params }: Params) {
	const { slug } = params;
	// const post = allPosts.find(
	// 	(singlePost) => singlePost._raw.flattenedPath === `words/${slug}`,
	// );

	const file = fs.readFileSync(`src/content/words/${slug}.mdx`, "utf8");
	const post = matter(file);

	if (!post) {
		return <div>Post not found</div>;
	}
	return (
		<LongPost
			content={post.content}
			title={post.data.title}
			date={post.data.date}
			thumbnailUrl={post.data.thumbnailUrl ?? DEFAULT_IMAGE_URL}
			description={post.data.description}
		/>
	);
}
