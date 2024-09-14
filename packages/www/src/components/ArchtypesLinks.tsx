import { Link } from "@tanstack/react-router";
import { MDXArchiveTypes } from "@gbfm/core/mdx/mdx.types";

export const ArchetypesLinks = () => {
	return (
		<ul>
			{MDXArchiveTypes.archetypeSchema.options.map((archetype) => (
				<li key={archetype}>
					<Link
						to="/archetype/$type"
						params={{
							type: archetype,
						}}
					>
						{archetype}
					</Link>
				</li>
			))}
		</ul>
	);
};
