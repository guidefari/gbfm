import { MDXRendrr } from "@/components/MDXRendrr";
import { API_BASE_URL, fetcher } from "@/lib/http";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/read/$archetype/$id")({
	component: ReadSingle,
});

function ReadSingle() {
	const { archetype, id } = Route.useParams();

	const { data, isLoading, error, isFetching } = useQuery({
		queryKey: ["read-single"],
		queryFn: async () =>
			fetcher(`${API_BASE_URL}/mdx-archive/read`, {
				method: "POST",
				body: JSON.stringify({
					filename: `${archetype}/${id}.mdx`,
				}),
			}),
	});

	if (isLoading || isFetching) return <div>Loading...</div>;
	if (error) return <div>Error: {error.message}</div>;

	return <MDXRendrr mdxString={data?.compiled} />;
}
