import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
	component: Index,
});

function Index() {
	return (
		<>
			<h1>gbfm reimagined innit.</h1>
			<p>testing CI👀</p>
		</>
	);
}
