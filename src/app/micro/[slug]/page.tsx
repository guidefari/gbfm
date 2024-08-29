import { allTweets, type Tweet } from "@/contentlayer/generated";
import { Tweet as SingleTweet } from "src/components/Tweet";
import type { GetStaticProps, Metadata } from "next";
import { DEFAULT_IMAGE_URL } from "@/constants";

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
	// const post = allPosts.find(
	// 	(singlePost) => singlePost._raw.flattenedPath === `words/${slug}`,
	// );
	const tweet = allTweets.find(
		(singleTweet) => singleTweet._raw.flattenedPath === `micro/${params.slug}`,
	);
	return {
		title: tweet?.authorName,
		description: tweet?.body.code,
		openGraph: {
			images: [tweet?.avatarUrl ?? DEFAULT_IMAGE_URL],
		},
	};
}

const PostLayout = ({ params }: Params) => {
	const { slug } = params;
	const tweet = allTweets.find(
		(singleTweet) => singleTweet._raw.flattenedPath === `micro/${slug}`,
	);

	if (!tweet) {
		return <div>Micro post not found</div>;
	}

	return (
		<>
			<article className="w-full max-w-4xl min-h-screen py-8 mx-auto">
				<SingleTweet
					authorName={tweet.authorName}
					avatarUrl={tweet.avatarUrl}
					date={tweet.date}
					handle={tweet.handle || ""}
					content={tweet.body.raw}
					url={tweet.url}
					underline={false}
				/>
			</article>
		</>
	);
};

export default PostLayout;
