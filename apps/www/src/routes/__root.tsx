import { CommandDialogDemo } from "@/components/Commando";
import AppShell from "@/components/Layout/AppShell";
import { ThemeProvider } from "@/components/ThemeProvider";
import { Toaster } from "@/components/ui/toaster";
import { AudioProvider } from "@/contexts/AudioPlayer";
import { env } from "@/env";
import { FPSMeter } from "@overengineering/fps-meter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Outlet, createRootRoute } from "@tanstack/react-router";
import { Suspense } from "react";

const queryClient = new QueryClient({
	defaultOptions: {
		queries: {
			staleTime: 2 * 60 * 1000, // 5 minutes
			refetchOnWindowFocus: false,
			retry: 1,
		},
	},
});

export const Route = createRootRoute({
	component: () => (
		<>
			<ThemeProvider>
				<AudioProvider>
					<QueryClientProvider client={queryClient}>
						<AppShell showFooter={location.pathname !== "/"}>
							{env.isDev && (
								<FPSMeter className="fixed top-0 right-0 z-50" height={40} />
							)}
							<CommandDialogDemo />
							<Outlet />
						</AppShell>
					</QueryClientProvider>
				</AudioProvider>
			</ThemeProvider>
			<Toaster />
			<Suspense>{/* <TanStackRouterDevtools position="" /> */}</Suspense>
		</>
	),
});
