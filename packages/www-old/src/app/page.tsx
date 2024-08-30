import { redirect } from "next/navigation";
import { PostCard } from "src/components/PostCard";
import { compareDesc } from "date-fns";
import {
	allPosts,
	type Post,
	allMixes,
	type Mix,
} from "@/contentlayer/generated";
import { DEFAULT_IMAGE_URL } from "@/constants";
import Link from "next/link";

export default function Index() {
	redirect("/words");
}

function Curated() {
	const posts: Post[] = allPosts
		.sort((a, b) =>
			compareDesc(new Date(a.lastmod || a.date), new Date(b.lastmod || b.date)),
		)
		.filter((post) => post.title !== "Template post");
	const draftsFilteredOut = posts.filter((post) => post?.draft !== true);

	const mixes: Mix[] = allMixes.sort((a, b) =>
		compareDesc(new Date(a.date), new Date(b.date)),
	);

	return (
		<>
			{/* <PageSEO title="Curated music - Posts" description="Curated Music & the occasional prose" /> */}
			{/* Add Link to a page with Spotify now playing. move the now playing app here? */}
			<section id="mixes">
				<div className="flex flex-col m-4 md:flex-row md:items-center ">
					<div className="text-4xl font-bold sm:text-6xl md:text-7xl">
						Mixes
					</div>
					<p className="text-sm font-normal leading-5 md:ml-4 md:mt-3 md:text-base">
						Stream or download on here. Also distribured via{" "}
						<Link href={"/rss.xml"}>RSS</Link>
					</p>
				</div>
				<div className="curated-posts">
					{mixes.map((mix: Mix) => (
						<PostCard
							slug={mix.url}
							title={mix.title}
							description={mix.description}
							date={mix.date}
							key={mix._id}
							thumbnailUrl={mix.thumbnailUrl ?? DEFAULT_IMAGE_URL}
						/>
					))}
				</div>
			</section>
			<section className="mt-28" id="words">
				<h3 className="title">Playlists & words</h3>
				<div className="curated-posts">
					{draftsFilteredOut.map((post: Post) => (
						<PostCard
							slug={post.url}
							title={post.title}
							description={post.description}
							date={post.date}
							key={post._id}
							thumbnailUrl={post.thumbnailUrl ?? DEFAULT_IMAGE_URL}
						/>
					))}
				</div>
			</section>
		</>
	);
}
