import { createFileRoute } from "@tanstack/react-router";
import landingPage from "@/mdx/landing-page.mdx";
import { CustomMDXComponents } from "@/components/mdx-components";
console.log("landingPage:", landingPage);

export const Route = createFileRoute("/")({
	component: Index,
});

function Index() {
	return landingPage({ components: CustomMDXComponents });
}
