import { LongPost } from "@/components/Layout/LongPost";
import { DEFAULT_IMAGE_URL } from "@/constants";
import type { Metadata } from "next";
import { allPosts } from "@/contentlayer/generated";

export async function generateStaticParams() {
	const paths: string[] = allPosts.map((word) => word.url);

	return paths.map((path) => ({
		slug: path,
	}));
}

type Params = {
	params: { slug: string };
};

export async function generateMetadata({ params }: Params): Promise<Metadata> {
	const { slug } = params;

	const word = allPosts.find((word) => word.fileName === slug);

	if (!word) {
		return {
			title: "Post not found",
		};
	}

	return {
		title: word.title,
		description: word.description,
		openGraph: {
			images: [word.thumbnailUrl ?? DEFAULT_IMAGE_URL],
		},
	};
}

export default async function PostPage({ params }: Params) {
	const { slug } = params;
	const word = allPosts.find((word) => word.fileName === slug);

	if (!word || word instanceof Error) {
		return <div>Post not found</div>;
	}

	return (
		<LongPost
			content={word.body.raw}
			title={word.title}
			date={word.date}
			thumbnailUrl={word.thumbnailUrl ?? DEFAULT_IMAGE_URL}
			description={word.description}
		/>
	);
}
