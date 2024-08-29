import { LongPost } from "@/components/Layout/LongPost";
import { DEFAULT_IMAGE_URL } from "@/constants";
import { allLabels } from "@/contentlayer/generated";
import type { Metadata } from "next";

export async function generateStaticParams() {
	const paths: string[] = allLabels.map((post) => post.url);

	return paths.map((path) => ({
		slug: path,
	}));
}

type Params = {
	params: {
		slug: string;
	};
};

export async function generateMetadata({ params }: Params): Promise<Metadata> {
	const post = allLabels.find(
		(label) => label._raw.flattenedPath === `labels/${params.slug}`,
	);
	if (!post) {
		return {
			title: "Post not found",
		};
	}

	return {
		title: post.name,
		description: post.body.raw?.slice(0, 150),
		openGraph: {
			images: [post.thumbnailUrl ?? DEFAULT_IMAGE_URL],
		},
	};
}

export default function PostPage({ params }: Params) {
	const post = allLabels.find(
		(label) => label._raw.flattenedPath === `labels/${params.slug}`,
	);
	if (!post) {
		return <div>Post not found</div>;
	}
	return (
		<LongPost
			content={post.body.raw}
			title={post.name}
			thumbnailUrl={post.thumbnailUrl}
		/>
	);
}
