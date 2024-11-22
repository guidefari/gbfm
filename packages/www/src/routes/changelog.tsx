import { createFileRoute } from "@tanstack/react-router";
import changelog from "@/mdx/changelog.md";
import { CustomMDXComponents } from "@/components/mdx-components";

export const Route = createFileRoute("/changelog")({
	component: () => changelog({ components: CustomMDXComponents }),
});
