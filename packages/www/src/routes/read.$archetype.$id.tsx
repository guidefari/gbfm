import { MDXRendrr } from "@/components/MDXRendrr";
import { API_BASE_URL, fetcher } from "@/lib/http";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useParams } from "@tanstack/react-router";

export const Route = createFileRoute("/read/$archetype/$id")({
	component: ReadSingle,
	// loader: async ({ params, location, route, context }) => {
	// 	console.log({ params, location, route, context });
	// 	const archetype = {};
	// 	// return { archetype: params.archetype, id: params.id };
	// },
});

function ReadSingle() {
	const { archetype, id } = Route.useParams();

	const { data, isLoading, error } = useQuery({
		queryKey: ["read-single"],
		queryFn: async () =>
			fetcher(`${API_BASE_URL}/mdx-archive/read`, {
				method: "POST",
				body: JSON.stringify({
					filename: `${archetype}/${id}.mdx`,
				}),
			}),
	});

	if (isLoading) return <div>Loading...</div>;
	if (error) return <div>Error: {error.message}</div>;

	return <MDXRendrr mdxString={data?.compiled} />;
}
