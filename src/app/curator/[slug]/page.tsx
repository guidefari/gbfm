import CustomLink from "src/components/CustomLink";
import Image from "next/image";
import type { Metadata } from "next";
import { DEFAULT_IMAGE_URL } from "@/constants";
import {
	getContentBody,
	getFrontMatter,
	getSlugsByContentType,
} from "@/content";
import { CustomMDXComponents } from "@/app/mdx-components";
import { MDXRemote } from "next-mdx-remote/rsc";

export async function generateStaticParams() {
	const paths: string[] = await getSlugsByContentType("authors");

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
	const author = await getFrontMatter({ type: "authors", name: slug });

	if (author instanceof Error) {
		return {
			title: "Author not found",
			description: "Author not found",
			openGraph: {
				images: [DEFAULT_IMAGE_URL],
			},
		};
	}

	const body = await getContentBody({ type: "authors", name: slug });

	return {
		title: author?.name,
		description: body?.slice(0, 150),
		openGraph: {
			images: [author?.avatar ?? DEFAULT_IMAGE_URL],
		},
	};
}

export default async function AuthorPage({ params }: Params) {
	const { slug } = params;
	const author = await getFrontMatter({ type: "authors", name: slug });
	const body = (await getContentBody({ type: "authors", name: slug })) ?? "";

	if (!author || author instanceof Error) {
		return <div>Author not found</div>;
	}

	return (
		<>
			<>
				<div className="flex flex-col justify-between mx-5 mt-10 mb-12 lg:flex-row md:mb-16 lg:mb-24">
					<Image
						src={author.avatar || "/placeholder-user.jpg"}
						alt="avatar"
						width="500"
						height="500"
						className="object-cover w-48 h-48 rounded-full aspect-square"
						priority
						quality={100}
					/>
					<div>
						<h1 className="title">{author.name}</h1>
						{author.title && <p>What I do: {author.title}</p>}
						{author.website && (
							<>
								Here's where you can find me on the{" "}
								<CustomLink href={author.website} as={author.website}>
									web
								</CustomLink>
							</>
						)}
						{author.title && (
							<p>
								I also have{" "}
								<CustomLink
									href={`mailto:${author.email}`}
									as={`mailto:${author.email}`}
								>
									email
								</CustomLink>{" "}
							</p>
						)}
						<article className="my-10 ">
							<MDXRemote components={CustomMDXComponents} source={body} />
						</article>
					</div>
				</div>
			</>
		</>
	);
}
