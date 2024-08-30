import { Tweet as SingleTweet } from "src/components/Tweet";
import type { Metadata } from "next";
import { DEFAULT_IMAGE_URL } from "@/constants";
import { allTweets } from "@/contentlayer/generated";

export async function generateStaticParams() {
	const paths: string[] = allTweets.map((tweet) => tweet.url);

	return paths.map((path) => ({
		slug: path,
	}));
}

type Params = {
	params: { slug: string };
};

export async function generateMetadata({ params }: Params): Promise<Metadata> {
	const { slug } = params;
	const tweet = allTweets.find((tweet) => tweet.fileName === slug);

	if (tweet instanceof Error) {
		return {
			title: "Micro post not found",
			description: "Micro post not found",
			openGraph: {
				images: [DEFAULT_IMAGE_URL],
			},
		};
	}

	return {
		title: tweet?.authorName,
		description: tweet?.body.raw.slice(0, 150),
		openGraph: {
			images: [tweet?.avatarUrl ?? DEFAULT_IMAGE_URL],
		},
	};
}

export default async function PostLayout({ params }: Params) {
	const { slug } = params;
	const tweet = allTweets.find((tweet) => tweet.fileName === slug);

	if (!tweet || tweet instanceof Error) {
		return <div>Micro post not found</div>;
	}

	return (
		<article className="w-full max-w-4xl min-h-screen py-8 mx-auto">
			<SingleTweet
				authorName={tweet.authorName}
				avatarUrl={tweet.avatarUrl}
				date={tweet.date}
				handle={tweet.handle || ""}
				content={tweet.body.raw}
				url={`/micro/${slug}`}
				underline={false}
			/>
		</article>
	);
}
