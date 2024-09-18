import { ThemeProvider } from "@/components/ThemeProvider";
import { Toaster } from "@/components/ui/toaster";
import { AudioProvider } from "@/contexts/AudioPlayer";
import { AuthProvider } from "@/contexts/AuthContext";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Outlet, createRootRoute } from "@tanstack/react-router";
import { Suspense, lazy } from "react";
import AppShell from "@/components/Layout/AppShell";

const queryClient = new QueryClient();

export const Route = createRootRoute({
	component: () => (
		<>
			<ThemeProvider>
				<AuthProvider>
					<AudioProvider>
						<QueryClientProvider client={queryClient}>
							<AppShell>
								<Outlet />
							</AppShell>
						</QueryClientProvider>
					</AudioProvider>
				</AuthProvider>
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
