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
import { useMutation } from "@tanstack/react-query";
import { API_BASE_URL, fetcher } from "@/lib/http";
import { Button } from "./ui/button";
import { Input } from "./ui/input";

type ContentType = {
	value: string;
	label: string;
};

const contentTypes: ContentType[] = [
	{ value: "micro", label: "Micro Post" },
	{ value: "post", label: "Post" },
	{ value: "mix", label: "Mix" },
];

export function Editor() {
	const [value, setValue] = useState("**Hello world!!!**");
	const [selectedTab, setSelectedTab] = useState<"write" | "preview">("write");
	const [type, setType] = useState<"micro" | "post" | "mix">("mdx");

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

	const { mutate, isPending } = useMutation({
		mutationFn: async (content: string) => {
			const res = await fetcher(`${API_BASE_URL}/micro-posts`, {
				method: "POST",
				body: JSON.stringify({ content }),
			});
			return res.json();
		},
	});

	return (
		<section>
			<Button onClick={() => mutate(value)} disabled={isPending}>
				{isPending ? "Saving..." : "Save"}
			</Button>
			<select
				value={type}
				onChange={(e) => setType(e.target.value as "micro" | "post" | "mix")}
			>
				{contentTypes.map((type) => (
					<option key={type.value} value={type.value}>
						{type.label}
					</option>
				))}
			</select>
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
						// className: "focus:outline-none focus:underline",
					},
					previewButton: {
						// className: "focus:outline-none focus:underline",
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
		</section>
	);
}

async function compileMdx(markdown: string) {
	// const gray = matter(markdown);
	const compiled = await compile(markdown, {
		outputFormat: "function-body",
	});
	return compiled.toString();
}
