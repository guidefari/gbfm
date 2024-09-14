import { createLazyFileRoute } from "@tanstack/react-router";
import { ArchetypesLinks } from "@/components/ArchtypesLinks";

export const Route = createLazyFileRoute("/archetype/")({
	component: LazyComponent,
});

function LazyComponent() {
	return <ArchetypesLinks />;
}
