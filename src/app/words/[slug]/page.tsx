import { LongPost } from "@/components/Layout/LongPost";
import { DEFAULT_IMAGE_URL } from "@/constants";
import type { Metadata } from "next";
import {
	getContentBody,
	getFrontMatter,
	getSlugsByContentType,
} from "@/content";

export async function generateStaticParams() {
	const paths: string[] = await getSlugsByContentType("words");

	return paths.map((path) => ({
		slug: path,
	}));
}

type Params = {
	params: { slug: string };
};

export async function generateMetadata({ params }: Params): Promise<Metadata> {
	const { slug } = params;

	// readdir, get the file from `src/content/words/${slug}.mdx`
	const frontMatter = await getFrontMatter({ type: "words", name: slug });

	if (!frontMatter) {
		return {
			title: "Post not found",
		};
	}

	if (frontMatter instanceof Error) {
		return {
			title: "Post not found",
		};
	}

	return {
		title: frontMatter.title,
		description: frontMatter.description,
		openGraph: {
			images: [frontMatter.thumbnailUrl ?? DEFAULT_IMAGE_URL],
		},
	};
}

export default async function PostPage({ params }: Params) {
	const { slug } = params;
	const post = await getFrontMatter({ type: "words", name: slug });

	if (!post || post instanceof Error) {
		return <div>Post not found</div>;
	}

	const body = await getContentBody({ type: "words", name: slug });

	return (
		<LongPost
			content={body ?? ""}
			title={post.title}
			date={post.date}
			thumbnailUrl={post.thumbnailUrl ?? DEFAULT_IMAGE_URL}
			description={post.description}
		/>
	);
}
