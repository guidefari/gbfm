import AppShell from "@/components/Layout/AppShell";
import { ThemeProvider } from "@/components/ThemeProvider";
import { Toaster } from "@/components/ui/toaster";
import { AudioProvider } from "@/contexts/AudioPlayer";
import { AuthProvider } from "@/contexts/AuthContext";
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
				<AuthProvider>
					<AudioProvider>
						<QueryClientProvider client={queryClient}>
							<AppShell showFooter={location.pathname !== "/"}>
								<Outlet />
							</AppShell>
						</QueryClientProvider>
					</AudioProvider>
				</AuthProvider>
			</ThemeProvider>
			<Toaster />
			<Suspense>{/* <TanStackRouterDevtools position="" /> */}</Suspense>
		</>
	),
});
