import { LongPost } from "@/components/Layout/LongPost";
import { type Label, allLabels } from "@/contentlayer/generated";

export const getStaticPaths = () => {
	const paths: string[] = allLabels.map((post) => post.url);
	return {
		paths,
		fallback: false,
	};
};

export const getStaticProps = ({ params }) => {
	const post: Label = allLabels.find(
		(label) => label._raw.flattenedPath === `labels/${params.slug}`,
	);

	return {
		props: {
			post,
		},
	};
};

export default function PostPage({ post }: { post: Label }) {
	return (
		<LongPost
			content={post.body.code}
			title={post.name}
			thumbnailUrl={post.thumbnailUrl}
		/>
	);
}
