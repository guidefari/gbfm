import { createFileRoute } from "@tanstack/react-router";
import landingPage from "@/mdx/landing-page.mdx";
import { CustomMDXComponents } from "@/components/mdx-components";

export const Route = createFileRoute("/")({
	component: Index,
});

function Index() {
	return landingPage({ components: CustomMDXComponents });
}
