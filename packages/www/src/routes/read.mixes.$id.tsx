import { API_BASE_URL, fetcher } from "@/lib/http";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { MDXArchiveTypes } from "@gbfm/core/mdx/mdx.types";
import { LongPost } from "@/components/Layout/LongPost";

export const Route = createFileRoute("/read/mixes/$id")({
	component: ReadSingle,
});

function ReadSingle() {
	const { id } = Route.useParams();

	const { data, isLoading, error, isFetching } =
		useQuery<MDXArchiveTypes.ReadOneResult>({
			queryKey: ["read-single"],
			queryFn: async () =>
				fetcher(`${API_BASE_URL}/mdx-archive/read`, {
					method: "POST",
					body: JSON.stringify({
						filename: `${MDXArchiveTypes.archetypeSchema.enum.mixes}/${id}.mdx`,
					}),
				}),
		});

	console.log({ data });

	if (isLoading || isFetching) return <div>Loading...</div>;
	if (error) return <div>Error: {error.message}</div>;
	if (!data) return <div>No data</div>;

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
