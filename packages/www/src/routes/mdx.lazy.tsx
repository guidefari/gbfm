import { createLazyFileRoute } from "@tanstack/react-router";
import { MDXProvider } from "@mdx-js/react";
import MyMarkdown from "../mdx/test.mdx";

export const Route = createLazyFileRoute("/mdx")({
	component: Component,
});

const components = {
	// @ts-expect-error - testing
	em: (props) => <i {...props} />,
};

function Component() {
	return (
		<MDXProvider components={components}>
			<MyMarkdown />
		</MDXProvider>
	);
}
