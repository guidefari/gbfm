import { LongPost } from "@/components/Layout/LongPost";
import { DEFAULT_IMAGE_URL } from "@/constants";
import { allMixes } from "@/contentlayer/generated";
import type { Metadata } from "next";

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
	const mix = allMixes.find(
		(mix) => mix._raw.flattenedPath === `mixes/${params.slug}`,
	);
	if (!mix) {
		return {
			title: "Post not found",
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

export default function PostPage({ params }: Params) {
	const mix = allMixes.find(
		(singlePost) => singlePost._raw.flattenedPath === `mixes/${params.slug}`,
	);
	if (!mix) {
		return <div>Post not found</div>;
	}
	return (
		<LongPost
			content={mix.body.code}
			title={mix.title}
			date={mix.date}
			thumbnailUrl={mix.thumbnailUrl ?? DEFAULT_IMAGE_URL}
			description={mix.description}
			youtubeId={mix.youtubeId}
			mp3Url={mix.mp3Url}
		/>
	);
}
