import { LongPost } from "@/components/Layout/LongPost";
import { type Post, allPosts } from "@/contentlayer/generated";

// Update to use async function for data fetching
// export async function generateStaticParams() {
// 	const paths = allPosts.map((post) => ({ slug: post.slug })); // Adjusted to match the new structure
// 	return paths;
// }

export default function PostPage({
	params: { slug },
}: {
	params: { slug: string };
}) {
	const post: Post = allPosts.find(
		(singlePost) => singlePost._raw.flattenedPath === `words/${slug}`,
	);
	return (
		<LongPost
			content={post.body.code}
			title={post.title}
			date={post.date}
			thumbnailUrl={post.thumbnailUrl}
			description={post.description}
			canonicalUrl={post.canonicalUrl}
		/>
	);
}
