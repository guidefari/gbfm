import * as runtime from "react/jsx-runtime";
import { CustomMDXComponents } from "./mdx-components";
import { run } from "@mdx-js/mdx";
import { useEffect, useState } from "react";

type LoadedContentType = Awaited<ReturnType<typeof run>>["default"];

export function MDXRendrr({ mdxString }: { mdxString: string }) {
	const [Content, setContent] = useState<LoadedContentType | null>(null); // State to hold Content

	useEffect(() => {
		const fetchContent = async () => {
			// @ts-expect-error: `runtime` types are currently broken.
			const { default: loadedContent } = await run(mdxString, {
				...runtime,
				baseUrl: import.meta.url,
			});
			setContent(() => loadedContent); // Set the loaded content
		};
		fetchContent();
	}, [mdxString]);

	return (
		<div>
			<h1>Async Component Example</h1>
			{Content ? <Content components={CustomMDXComponents} /> : null}{" "}
		</div>
	);
}
