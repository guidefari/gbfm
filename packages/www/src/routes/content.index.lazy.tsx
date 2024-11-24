import { createLazyFileRoute } from "@tanstack/react-router";
import { ArchetypesLinks } from "@/components/ArchtypesLinks";

export const Route = createLazyFileRoute("/content/")({
	component: LazyComponent,
});

function LazyComponent() {
	return <ArchetypesLinks />;
}
