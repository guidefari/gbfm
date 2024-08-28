import "@/styles/main.css";
import AppShell from "@/components/Layout/AppShell";
import { SessionProvider } from "next-auth/react";
import type { AppProps } from "next/app";
import Head from "next/head";
import { memo } from "react";
import { AudioProvider } from "src/contexts/AudioPlayer";
import { AuthProvider } from "src/contexts/AuthContext";
import { Toaster } from "@/components/ui/toaster";
import useScrollRestoration from "./hooks/useScrollRestoration";

const App = memo(function _({
	children,
}: {
	children: React.ReactNode;
}) {
	// useScrollRestoration();

	return (
		<>
			{/* <SessionProvider session={session}> */}
			<Head>
				<meta content="width=device-width, initial-scale=1" name="viewport" />
				<link
					rel="shortcut icon"
					href="/favicons/goose.png"
					type="image/x-icon"
				/>
				<meta name="color-scheme" content="dark" />
			</Head>

			<AudioProvider>
				<AuthProvider>
					<html lang="en">
						<body>
							<AppShell>
								{children}
								<Toaster />
							</AppShell>
						</body>
					</html>
				</AuthProvider>
			</AudioProvider>
			{/* </SessionProvider> */}
		</>
	);
});

export default App;
