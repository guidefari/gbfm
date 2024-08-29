import "@/styles/main.css";
import AppShell from "@/components/Layout/AppShell";
// import { SessionProvider } from "next-auth/react";
import { AudioProvider } from "src/contexts/AudioPlayer";
import { AuthProvider } from "src/contexts/AuthContext";
import { Toaster } from "@/components/ui/toaster";
// import useScrollRestoration from "./hooks/useScrollRestoration";
import type { Metadata } from "next";
import siteMetadata from "@/siteMetadata";

export const metadata: Metadata = {
	metadataBase: new URL("https://goosebumps.fm"),
	icons: {
		icon: "/favicons/goose.png",
	},
	title: {
		default: siteMetadata.title,
		template: "%s | goosebumps.fm",
	},
	description: siteMetadata.description,
	openGraph: {
		description: siteMetadata.description,
		images: [siteMetadata.socialBanner],
		url: siteMetadata.siteUrl,
	},
	twitter: {
		card: "summary_large_image",
		title: siteMetadata.title,
		description: siteMetadata.description,
		siteId: "",
		creator: siteMetadata.twitterHandle,
		creatorId: "",
		images: [siteMetadata.socialBanner],
	},
};

export default function RootLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	// useScrollRestoration();

	return (
		<>
			{/* <SessionProvider session={session}> */}
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
}
