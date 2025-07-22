import { fetcher } from "@/lib/http";
import { API_BASE_URL } from "@/lib/http";
import { createFileRoute } from "@tanstack/react-router";
import type { MicroPost } from "@gbfm/core/microPost/index.ts";
import { MDXRendrr } from "@/components/MDXRendrr";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/micro")({
	component: Component,
});

function Component() {
	const [currentPage, setCurrentPage] = useState(1);
	const itemsPerPage = 5;

	const { data, isPending } = useQuery({
		queryKey: ["microPosts"],
		queryFn: () =>
			fetcher<MicroPost.MicroPost[]>(`${API_BASE_URL}/micro-posts`, {
				skipAuth: true,
			}),
	});
	// const { microPosts } = Route.useLoaderData();
	if (isPending) {
		return <div>Loading...</div>;
	}

	if (data) {
		const totalPages = Math.ceil(data.length / itemsPerPage);
		const startIndex = (currentPage - 1) * itemsPerPage;
		const currentData = data.slice(startIndex, startIndex + itemsPerPage);

		return (
			<div className="flex flex-col gap-4">
				{currentData.map((microPost) => (
					<div className="my-2 border-b-2" key={microPost.contentId}>
						<MDXRendrr mdxString={microPost.content} />
					</div>
				))}
				<div className="flex justify-center gap-2">
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
				</div>
			</div>
		);
	}
}
