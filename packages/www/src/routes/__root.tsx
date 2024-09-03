import { NavBar } from "@/components/NavBar";
import { ThemeProvider } from "@/components/ThemeProvider";
import { Toaster } from "@/components/ui/toaster";
import { Outlet, createRootRoute } from "@tanstack/react-router";
import { Suspense, lazy } from "react";

export const Route = createRootRoute({
	component: () => (
		<>
			<ThemeProvider>
				<div className="flex flex-col">
					<NavBar />
					<main className="flex-1 w-full h-full font-inter ">
						<Outlet />
					</main>
				</div>
			</ThemeProvider>
			<Toaster />
			<Suspense>
				<TanStackRouterDevtools />
			</Suspense>
		</>
	),
});

const TanStackRouterDevtools =
	process.env.NODE_ENV === "production"
		? () => null // Render nothing in production
		: lazy(() =>
				// Lazy load in development
				import("@tanstack/router-devtools").then((res) => ({
					default: res.TanStackRouterDevtools,
					// For Embedded Mode
					// default: res.TanStackRouterDevtoolsPanel
				})),
			);
