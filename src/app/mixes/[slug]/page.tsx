import { LongPost } from "@/components/Layout/LongPost";
import { DEFAULT_IMAGE_URL } from "@/constants";
import type { Metadata } from "next";
import {
	getContentBody,
	getFrontMatter,
	getSlugsByContentType,
} from "@/content";

export async function generateStaticParams() {
	const paths: string[] = await getSlugsByContentType("mixes");

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
	const mix = await getFrontMatter({ type: "mixes", name: slug });

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
	const mix = await getFrontMatter({ type: "mixes", name: slug });
	const body = await getContentBody({ type: "mixes", name: slug });

	if (!mix || mix instanceof Error) {
		return <div>Mix not found</div>;
	}

	return (
		<LongPost
			content={body ?? ""}
			title={mix.title}
			date={mix.date}
			thumbnailUrl={mix.thumbnailUrl ?? DEFAULT_IMAGE_URL}
			description={mix.description}
			youtubeId={mix.youtubeId}
			mp3Url={mix.mp3Url}
		/>
	);
}
