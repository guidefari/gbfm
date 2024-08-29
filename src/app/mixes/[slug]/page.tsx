import { LongPost } from "@/components/Layout/LongPost";
import { DEFAULT_IMAGE_URL } from "@/constants";
import type { Metadata } from "next";
import { allMixes } from "@/contentlayer/generated";

export async function generateStaticParams() {
	const paths: string[] = allMixes.map((mix) => mix.url);

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
	const { slug } = params;
	const mix = allMixes.find((mix) => mix.fileName === slug);

	if (!mix || mix instanceof Error) {
		return {
			title: "Mix not found",
			description: "Mix not found",
			openGraph: {
				images: [DEFAULT_IMAGE_URL],
			},
		};
	}

	return {
		title: mix.title,
		description: mix.description,
		openGraph: {
			images: [mix.thumbnailUrl ?? DEFAULT_IMAGE_URL],
		},
	};
}

export default async function PostPage({ params }: Params) {
	const { slug } = params;
	const mix = allMixes.find((mix) => mix.fileName === slug);

	if (!mix || mix instanceof Error) {
		return <div>Mix not found</div>;
	}

	return (
		<LongPost
			content={mix.body.raw}
			title={mix.title}
			date={mix.date}
			thumbnailUrl={mix.thumbnailUrl ?? DEFAULT_IMAGE_URL}
			description={mix.description}
			youtubeId={mix.youtubeId}
			mp3Url={mix.mp3Url}
		/>
	);
}
