import { LongPost } from "@/components/Layout/LongPost";
import { DEFAULT_IMAGE_URL } from "@/constants";
import { allLabels } from "@/contentlayer/generated";
import type { Metadata } from "next";

export async function generateStaticParams() {
	const paths: string[] = allLabels.map((label) => label.url);

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
	const label = allLabels.find((label) => label.fileName === params.slug);

	if (!label || label instanceof Error) {
		return {
			title: "Label not found",
		};
	}

	return {
		title: label.name,
		description: label.body.raw.slice(0, 150),
		openGraph: {
			images: [label.thumbnailUrl ?? DEFAULT_IMAGE_URL],
		},
	};
}

export default async function PostPage({ params }: Params) {
	const label = allLabels.find((label) => label.fileName === params.slug);

	if (!label || label instanceof Error) {
		return <div>Post not found</div>;
	}

	return (
		<LongPost
			content={label.body.raw}
			title={label.name}
			thumbnailUrl={label.thumbnailUrl}
		/>
	);
}
