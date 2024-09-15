import { createLazyFileRoute } from "@tanstack/react-router";
import { useMDXArchive } from "@/lib/http";
import { run } from "@mdx-js/mdx";
import * as runtime from "react/jsx-runtime";
import { useEffect, useState } from "react";
import { CustomMDXComponents } from "@/components/mdx-components";

export const Route = createLazyFileRoute("/mdx")({
	component: Component,
});

type LoadedContentType = Awaited<ReturnType<typeof run>>["default"];

function Component() {
	const { data, error, isLoading } = useMDXArchive("words/jazz-codes.mdx");
	const [Content, setContent] = useState<LoadedContentType | null>(null); // State to hold Content
	console.log("Content:", Content);
	console.log("data:", data);

	// what a monstrosity piece of code. Father forgive me for I have sinned.😭
	// if you're reading this, it's a PoC.

	useEffect(() => {
		const fetchContent = async () => {
			// @ts-expect-error: `runtime` types are currently broken.
			const { default: loadedContent } = await run(data?.compiled, {
				...runtime,
				baseUrl: import.meta.url,
			});
			setContent(() => loadedContent); // Set the loaded content
		};

		if (data?.compiled) {
			fetchContent();
		}
	}, [data?.compiled]);

	if (isLoading) return <div>Loading...</div>;
	if (error) return <div>Error: {error.message}</div>;

	return (
		<>
			{/* {data && data.result.content} */}
			{/* <MyMarkdown /> */}
			{Content ? <Content components={CustomMDXComponents} /> : null}
		</>
	);
}
