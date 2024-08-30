import { createLazyFileRoute } from "@tanstack/react-router";

export const Route = createLazyFileRoute("/mixes")({
	component: Component,
});

function Component() {
	return <div>Mixes</div>;
}
