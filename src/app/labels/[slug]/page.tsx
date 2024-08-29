import { LongPost } from "@/components/Layout/LongPost";
import { DEFAULT_IMAGE_URL } from "@/constants";
import {
	getContentBody,
	getFrontMatter,
	getSlugsByContentType,
} from "@/content";
import { allLabels } from "@/contentlayer/generated";
import type { Metadata } from "next";

export async function generateStaticParams() {
	const paths: string[] = await getSlugsByContentType("labels");

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
	const post = await getFrontMatter({ type: "labels", name: params.slug });

	if (!post || post instanceof Error) {
		return {
			title: "Label not found",
		};
	}

	const body = await getContentBody({ type: "labels", name: params.slug });

	return {
		title: post.name,
		description: body?.slice(0, 150),
		openGraph: {
			images: [post.thumbnailUrl ?? DEFAULT_IMAGE_URL],
		},
	};
}

export default async function PostPage({ params }: Params) {
	const post = await getFrontMatter({ type: "labels", name: params.slug });

	if (!post || post instanceof Error) {
		return <div>Post not found</div>;
	}

	const body = await getContentBody({ type: "labels", name: params.slug });
	if (!post) {
		return <div>Post not found</div>;
	}
	return (
		<LongPost
			content={body ?? ""}
			title={post.name}
			thumbnailUrl={post.thumbnailUrl}
		/>
	);
}
