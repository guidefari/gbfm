import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
	component: Index,
});

function Index() {
	return (
		<div className="flex flex-col justify-center items-center px-1 leading-none h-dvh">
			<h1 className="my-0 text-5xl font-bold text-right w-fit md:text-7xl">
				goosebumps.
				<br />
				<span className="text-highlight">fm</span>
			</h1>
		</div>
	);
}
