import { createFileRoute, Link } from "@tanstack/react-router";
import { useArchetype } from "@/lib/http";
import { MDXArchiveTypes } from "@gbfm/core/mdx/mdx.types";
import { ArchetypesLinks } from "@/components/ArchtypesLinks";

export const Route = createFileRoute("/_archetypeList")({
	component: Component,
	errorComponent: PostErrorComponent,
	loader: async ({ location }) => {
		const archetypeFromUrl = location.pathname.split("/")[1];
		const archetype = MDXArchiveTypes.archetypeSchema.parse(archetypeFromUrl);
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

	const { data, isLoading, error } = useArchetype(archetype);

	return (
		<div>
			<h2>Archetype: {archetype}</h2>
			{isLoading && <div>Loading...</div>}
			<ul className="mx-2">
				{!isLoading &&
					!error &&
					data?.result.length &&
					data.result.map((post) => (
						<li className="" key={post}>
							<Link to={`/read/${archetype}/${post}`}>{post}</Link>
						</li>
					))}
			</ul>
			{/* <h1>{data?.result.map((archetype) => archetype).join(", ")}</h1> */}
		</div>
	);
}
