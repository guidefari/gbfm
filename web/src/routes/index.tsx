import { cn } from "@/lib/utils";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/")({
	component: Index,
});

function Index() {
	const [oneSecondLater, setOneSecondLater] = useState(false);
	const timeout = setTimeout(() => {
		setOneSecondLater(true);
	}, 1000);

	useEffect(() => {
		return () => clearTimeout(timeout);
	}, [timeout]);

	return (
		<div className="flex flex-col justify-center items-center px-1 leading-none h-dvh">
			<div className="inline-block w-fit">
				<h1 className="my-0 text-5xl font-bold text-right w-fit md:text-7xl">
					goosebumps.
					<br />
					<span className="text-highlight">fm</span>
					<aside className="text-sm">
						<p
							className={cn(
								"text-sm text-left w-full text-background opacity-0 transition-all duration-500 ease-in-out",
								oneSecondLater && "text-muted-foreground opacity-100",
							)}
						>
							Press{" "}
							<kbd
								className={cn(
									"pointer-events-none inline-flex h-5 bg-muted text-muted-foreground items-center gap-1 rounded border px-1.5 font-mono text-[10px] font-medium opacity-100 select-none",
								)}
							>
								<span className="text-xs">
									{navigator.platform.includes("Mac") ? "⌘" : "Ctrl"}
								</span>
								K
							</kbd>
						</p>
					</aside>
				</h1>
			</div>
		</div>
	);
}
