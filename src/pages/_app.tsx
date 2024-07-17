import "@/css/main.css";
import AppShell from "@/components/Layout/AppShell";
import { ScrollPosition } from "@/components/ScrollPosition";
import { SessionProvider } from "next-auth/react";
import type { AppProps } from "next/app";
import Head from "next/head";
import { memo } from "react";
import { AudioProvider } from "src/contexts/AudioPlayer";
import { AuthProvider } from "src/contexts/AuthContext";

const App = memo(function _({
	Component,
	pageProps: { session, ...pageProps },
}: AppProps) {
	return (
		<SessionProvider session={session}>
			<Head>
				<meta content="width=device-width, initial-scale=1" name="viewport" />
				<link
					rel="shortcut icon"
					href="/favicons/goose.png"
					type="image/x-icon"
				/>
				<meta name="color-scheme" content="dark" />
			</Head>
			<ScrollPosition />

			<AudioProvider>
				<AuthProvider>
					<AppShell>
						<Component {...pageProps} />
					</AppShell>
				</AuthProvider>
			</AudioProvider>
		</SessionProvider>
	);
});

export default App;
