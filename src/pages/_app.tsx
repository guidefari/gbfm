import "@/css/main.css";
import type { AppProps } from "next/app";
import { AudioProvider } from "src/contexts/AudioPlayer";

import AppShell from "@/components/Layouts/AppShell";
import { ScrollPosition } from "@/components/ScrollPosition";
import { SessionProvider } from "next-auth/react";
import Head from "next/head";
import { memo } from "react";

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
				<AppShell>
					<Component {...pageProps} />
				</AppShell>
			</AudioProvider>
		</SessionProvider>
	);
});

export default App;
