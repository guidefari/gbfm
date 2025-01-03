import { LongPost } from "@/components/Layout/LongPost";
import { MDXRendrr } from "@/components/MDXRendrr";
import { API_BASE_URL, fetcher } from "@/lib/http";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";

export const Route = createFileRoute("/read/$archetype/$id")({
	component: ReadSingle,
});

function ReadSingle() {
	const { archetype, id } = Route.useParams();

	const { data, isLoading, error, isFetching, refetch } = useQuery({
		queryKey: ["read-single"],
		queryFn: async () =>
			fetcher(`${API_BASE_URL}/mdx-archive/read`, {
				method: "POST",
				body: JSON.stringify({
					filename: `${archetype}/${id}.mdx`,
				}),
			}),
	});

	// biome-ignore lint/correctness/useExhaustiveDependencies: stable function
	useEffect(() => {
		refetch();
	}, [archetype, id]);

	if (isLoading || isFetching) return <div>Loading...</div>;
	if (error) return <div>Error: {error.message}</div>;

	if (!data) return <div>No data</div>;

	if (archetype === "micro") {
		return <MDXRendrr mdxString={data.compiled as string} />;
	}

	return (
		<LongPost
			title={data.gray?.data.title}
			description={data.gray?.data.description}
			content={data.compiled as string}
			thumbnailUrl={data.gray?.data.thumbnailUrl}
			date={data.gray?.data.date}
			youtubeId={data.gray?.data.youtubeId}
			mp3Url={data.gray?.data.mp3Url}
		/>
	);
}
