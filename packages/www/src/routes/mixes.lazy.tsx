import { createLazyFileRoute } from "@tanstack/react-router";
import { useMixes } from "@/lib/http";

export const Route = createLazyFileRoute("/mixes")({
	component: Component,
});

function Component() {
	const { mixes, isLoading, isError } = useMixes();

	if (isLoading || !mixes) return <div>Loading...</div>;
	if (isError) return <div>Error</div>;

	return (
		<div>
			Mixes
			<ul className="mx-2">
				{mixes.result.length &&
					mixes.result.map((mix) => (
						<li className="" key={mix}>
							{mix}
						</li>
					))}
			</ul>
		</div>
	);
}
