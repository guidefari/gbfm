import { useState } from "react";
import ReactMde from "react-mde";
// import { getDefaultToolbarCommands } from "react-mde";
import { MDXRendrr } from "./MDXRendrr";
// import "react-mde/lib/styles/css/react-mde-all.css";
import "react-mde/lib/styles/css/react-mde-toolbar.css";
import "react-mde/lib/styles/css/react-mde.css";
import "react-mde/lib/styles/css/react-mde-editor.css";
import "./editor.css";
import { compile } from "@mdx-js/mdx";

export function Editor() {
	const [value, setValue] = useState("**Hello world!!!**");
	const [selectedTab, setSelectedTab] = useState<"write" | "preview">("write");

	const save = async function* (data: ArrayBuffer) {
		// Promise that waits for "time" milliseconds
		const wait = (time: number) =>
			new Promise<void>((resolve) => {
				setTimeout(resolve, time);
			});

		// Upload "data" to your server
		// Use XMLHttpRequest.send to send a FormData object containing
		// "data"
		// Check this question: https://stackoverflow.com/questions/18055422/how-to-receive-php-image-data-over-copy-n-paste-javascript-with-xmlhttprequest

		await wait(2000);
		// yields the URL that should be inserted in the markdown
		yield "https://picsum.photos/300";
		await wait(2000);

		// returns true meaning that the save was successful
		return true;
	};

	return (
		<ReactMde
			value={value}
			onChange={setValue}
			selectedTab={selectedTab}
			onTabChange={setSelectedTab}
			generateMarkdownPreview={async (markdown) => {
				const compiled = await compileMdx(markdown);
				return Promise.resolve(<MDXRendrr mdxString={compiled} />);
			}}
			childProps={{
				writeButton: {
					tabIndex: -1,
				},
			}}
			paste={{
				saveImage: save,
			}}
			classes={{
				textArea: "focus:outline-none bg-transparent label:rounded-lg ",
				toolbar: "bg-transparent border-none",
				reactMde: "focus:outline-none border-none",
			}}
			toolbarCommands={[["link", "image"]]}
		/>
	);
}

async function compileMdx(markdown: string) {
	// console.log("markdown:", markdown);
	// const gray = matter(markdown);
	// console.log("gray:", gray);
	const compiled = await compile(markdown, {
		outputFormat: "function-body",
	});
	return compiled.toString();
}
