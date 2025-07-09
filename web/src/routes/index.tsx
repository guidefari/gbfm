import { createFileRoute } from "@tanstack/react-router";
import { version } from "../../package.json";

export const Route = createFileRoute("/")({
	component: Index,
});

function Index() {
	return (
		<div className="flex flex-col justify-center items-center px-1 leading-none h-dvh">
			<div className="inline-block w-fit">
				<h1 className="my-0 text-5xl font-bold text-right w-fit md:text-7xl">
					goosebumps.
					<br />
					<span className="text-highlight">fm</span>
					<aside className="text-sm text-right opacity-60">v{version}</aside>
				</h1>
			</div>
		</div>
	);
}
