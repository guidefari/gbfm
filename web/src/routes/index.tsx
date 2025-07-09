import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import React from "react";
import { version } from "../../package.json";

export const Route = createFileRoute("/")({
	component: Index,
});

function Index() {
	const router = Route.useNavigate();

	React.useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === "0") {
				e.preventDefault();
				router({ to: "/mixes" });
			}
		};
		document.addEventListener("keydown", handleKeyDown);
		return () => document.removeEventListener("keydown", handleKeyDown);
	}, [router]);

	return (
		<div className="flex flex-col justify-center items-center px-1 leading-none h-dvh">
			<div className="inline-block w-fit">
				<h1 className="my-0 text-5xl font-bold text-right w-fit md:text-7xl">
					goosebumps.
					<br />
					<span className="text-highlight">fm</span>
					<aside className="text-sm text-right opacity-60">v{version}</aside>
				</h1>
				<nav className="flex gap-4" aria-label="Main navigation">
					<Link
						to="/mixes"
						className="px-3 py-1 rounded focus:outline-none focus:ring-2 focus:ring-highlight focus:ring-offset-2"
						aria-label="Go to mixes page (press 0)"
					>
						[0]Mixes
					</Link>
				</nav>
			</div>
		</div>
	);
}
