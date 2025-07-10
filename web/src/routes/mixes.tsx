import { useMixes } from "@/lib/http";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/mixes")({
	component: Component,
});

function Component() {
	const { data } = useMixes();
	return (
		<div>
			{data?.map((mix) => (
				<div key={mix.id}>
					<h2>{mix.title}</h2>
				</div>
			))}
		</div>
	);
}
