import { PostCard } from "@/components/PostCard";
import { DEFAULT_IMAGE_URL } from "@/lib/constants";
import { fetcher } from "@/lib/http";
import { API_BASE_URL } from "@/lib/http";
// import type { MicroPost } from "@gbfm/core/microPost/index.ts";
import type { PostFrontmatter } from "@gbfm/core/post/schema";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { compareDesc } from "date-fns";
import { useState } from "react";

interface ContentResponse {
	content: PostFrontmatter[];
}

export const Route = createFileRoute("/words")({
	component: Component,
});

function Component() {
	const [currentPage, setCurrentPage] = useState(1);
	const itemsPerPage = 5;

	const { data, isFetching, isPending } = useQuery({
		queryKey: ["posts"],
		queryFn: () =>
			fetcher<ContentResponse>(`${API_BASE_URL}/content?type=post`, {
				skipAuth: true,
			}),
	});

	// const { microPosts } = Route.useLoaderData();
	if (isPending) {
		return <div>Loading...</div>;
	}

	if (data) {
		const { content } = data;
		const posts = content
			.sort((a, b) =>
				compareDesc(
					new Date(a.lastmod || a.date),
					new Date(b.lastmod || b.date),
				),
			)
			.filter((post) => post.title !== "Template post");
		const draftsFilteredOut = posts.filter((post) => post?.draft !== true);

		// const totalPages = Math.ceil(content.length / itemsPerPage);
		// const startIndex = (currentPage - 1) * itemsPerPage;
		// const currentData = content.slice(startIndex, startIndex + itemsPerPage);

		return (
			<div className="grid w-full gap-10 px-4 py-16 mx-auto sm:grid-cols-2 lg:grid-cols-3 lg:px-8 lg:py-20;">
				{draftsFilteredOut.map((post) => (
					<PostCard
						slug={`/read/words/${post.contentId}`}
						title={post.title}
						description={post.description}
						date={post.date}
						key={post.slug}
						thumbnailUrl={post.thumbnailUrl ?? DEFAULT_IMAGE_URL}
					/>
				))}
				{/* <div className="flex justify-center gap-2">
					<Button
						disabled={currentPage === 1}
						onClick={() => setCurrentPage((prev) => prev - 1)}
					>
						Previous
					</Button>
					<span>
						Page {currentPage} of {totalPages}
					</span>
					<Button
						disabled={currentPage === totalPages}
						onClick={() => setCurrentPage((prev) => prev + 1)}
					>
						Next
					</Button>
				</div> */}
			</div>
		);
	}
}
