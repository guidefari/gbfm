import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_archetype/mixes")({
	component: () => <div>Hello /_archetype/mixes!</div>,
});
