import { createFileRoute } from "@tanstack/react-router";
import { useArchetype } from "@/lib/http";
import { MDXArchiveTypes } from "@gbfm/core/mdx/mdx.types";
import { ArchetypesLinks } from "@/components/ArchtypesLinks";

export const Route = createFileRoute("/archetype/$type")({
	component: Component,
	errorComponent: PostErrorComponent,
	loader: async ({ params }) => {
		const archetype = MDXArchiveTypes.archetypeSchema.parse(params.type);
		return archetype;
	},
});

export function PostErrorComponent() {
	return (
		<div>
			That content type doesn't exist
			<img
				src="https://media.tenor.com/a03Ni7kj3IkAAAAC/raven-nervous.gif"
				alt="Raven Nervous"
			/>
			try these out:
			<ArchetypesLinks />
		</div>
	);
}

function Component() {
	const archetype = Route.useLoaderData();

	const { data, isLoading, error, isValidating } = useArchetype(archetype);

	return (
		<div>
			<h2>Archetype: {archetype}</h2>
			{isLoading && <div>Loading...</div>}
			{isValidating && <div>Validating...</div>}
			<ul className="mx-2">
				{!isLoading &&
					!error &&
					!isValidating &&
					data?.result.length &&
					data.result.map((post) => (
						<li className="" key={post}>
							{post}
						</li>
					))}
			</ul>
			{/* <h1>{data?.result.map((archetype) => archetype).join(", ")}</h1> */}
		</div>
	);
}
