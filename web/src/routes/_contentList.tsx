import { ArchetypesLinks } from "@/components/ArchtypesLinks";
import { useArchetype } from "@/lib/http";
import { capitalizeFirstLetter } from "@/lib/utils";
import { MDXArchiveTypes } from "@gbfm/core/mdx/mdx.types";
import { Link, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_contentList")({
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

	const { data, isPending, error } = useArchetype(archetype);

	return (
		<div>
			<h2>{capitalizeFirstLetter(archetype)}</h2>
			{isPending && <div>Loading...</div>}
			<ul className="mx-2">
				{!isPending &&
					!error &&
					data?.result?.map((post) => (
						<li className="" key={post}>
							<Link to={`/read/${archetype}/${post}`}>{post}</Link>
						</li>
					))}
			</ul>
			{!isPending && !error && data?.result?.length === 0 && (
				<>
					<h3>No posts found</h3>
					<p>
						Probably due to the content still being migrated 💀. Check back
						later.
					</p>
				</>
			)}
			{/* <h1>{data?.result.map((archetype) => archetype).join(", ")}</h1> */}
		</div>
	);
}
