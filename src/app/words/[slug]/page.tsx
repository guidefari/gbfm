import { LongPost } from "@/components/Layout/LongPost";
import { DEFAULT_IMAGE_URL } from "@/constants";
import { allPosts } from "@/contentlayer/generated";
import type { Metadata } from "next";

export async function generateStaticParams() {
	const paths: string[] = allPosts.map((post) => post.url);

	return paths.map((path) => ({
		slug: path,
	}));
}

type Params = {
	slug: string;
};

export async function generateMetadata({ slug }: Params): Promise<Metadata> {
	const post = allPosts.find(
		(singlePost) => singlePost._raw.flattenedPath === `words/${slug}`,
	);
	if (!post) {
		return {
			title: "Post not found",
		};
	}
	return {
		title: post.title,
		description: post.description,
		openGraph: {
			images: [post.thumbnailUrl ?? DEFAULT_IMAGE_URL],
		},
	};
}

export default function PostPage({ slug }: Params) {
	const post = allPosts.find(
		(singlePost) => singlePost._raw.flattenedPath === `words/${slug}`,
	);
	if (!post) {
		return <div>Post not found</div>;
	}
	return (
		<LongPost
			content={post.body.code}
			title={post.title}
			date={post.date}
			thumbnailUrl={post.thumbnailUrl ?? DEFAULT_IMAGE_URL}
			description={post.description}
			canonicalUrl={post.canonicalUrl}
		/>
	);
}
