import { LongPost } from "@/components/Layout/LongPost";
import { MDXRendrr } from "@/components/MDXRendrr";
import { API_BASE_URL, fetcher } from "@/lib/http";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/read/$archetype/$id")({
	component: ReadSingle,
});

function ReadSingle() {
	const { archetype, id } = Route.useParams();

	const { data, error,  isPending } = useQuery({
		queryKey: ["read-single", archetype, id],
		staleTime: 2 * 60 * 1000,
		queryFn: async () =>{
			if (archetype === "words") {
				return fetcher(`${API_BASE_URL}/content/${id}`, );
			  }
			  return fetcher(`${API_BASE_URL}/mdx-archive/read`, {
				method: "POST",
				body: JSON.stringify({
				  filename: `${archetype}/${id}.mdx`,
				}),
			  });}
	});


	if (isPending) return <div>Loading...</div>;
	if (error) return <div>Error: {error.message}</div>;

	if (!data) return <div>No data</div>;
	console.log('data:', data)

	if (archetype === "micro") {
		return <MDXRendrr mdxString={data.compiled as string} />;
	}


	return (
		// todo: lol this needs to get cleaned up when there's time
		<LongPost
			title={data.gray?.data.title ?? data.title}
			description={data.gray?.data.description ?? data.description}
			content={data.compiled as string ?? data.content}
			thumbnailUrl={data.gray?.data.thumbnailUrl ?? data.thumbnailUrl}
			date={data.gray?.data.date ?? data.date}
			youtubeId={data.gray?.data.youtubeId ?? data.youtubeId}
			mp3Url={data.gray?.data.mp3Url ?? data.mp3Url}
		/>
	);
}
