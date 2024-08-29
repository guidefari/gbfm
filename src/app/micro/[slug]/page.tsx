import { Tweet as SingleTweet } from "src/components/Tweet";
import type { Metadata } from "next";
import { DEFAULT_IMAGE_URL } from "@/constants";
import {
	getContentBody,
	getFrontMatter,
	getSlugsByContentType,
} from "@/content";

export async function generateStaticParams() {
	const paths: string[] = await getSlugsByContentType("micro");

	return paths.map((path) => ({
		slug: path,
	}));
}

type Params = {
	params: { slug: string };
};

export async function generateMetadata({ params }: Params): Promise<Metadata> {
	const { slug } = params;
	const tweet = await getFrontMatter({ type: "micro", name: slug });

	if (tweet instanceof Error) {
		return {
			title: "Micro post not found",
			description: "Micro post not found",
			openGraph: {
				images: [DEFAULT_IMAGE_URL],
			},
		};
	}

	const body = await getContentBody({ type: "micro", name: slug });

	return {
		title: tweet?.authorName,
		description: body?.slice(0, 150),
		openGraph: {
			images: [tweet?.avatarUrl ?? DEFAULT_IMAGE_URL],
		},
	};
}

export default async function PostLayout({ params }: Params) {
	const { slug } = params;
	const tweet = await getFrontMatter({ type: "micro", name: slug });
	const body = await getContentBody({ type: "micro", name: slug });

	if (!tweet || tweet instanceof Error) {
		return <div>Micro post not found</div>;
	}

	return (
		<article className="w-full max-w-4xl min-h-screen py-8 mx-auto">
			<SingleTweet
				authorName={tweet.authorName}
				avatarUrl={tweet.avatarUrl}
				date={tweet.date.toISOString()}
				handle={tweet.handle || ""}
				content={body ?? ""}
				url={`/micro/${slug}`}
				underline={false}
			/>
		</article>
	);
}
