import type React from "react";
import Nav from "../Nav";
import { SideNav } from "../SideNav";
import { SuperHero } from "./SuperHero";

type Props = {
	children: React.ReactNode;
};

export default function AppShell({ children }: Props) {
	return (
		<>
			<SideNav />
			<main className="lg:pl-28 flex flex-col justify-between h-full overflow-hidden overflow-y-auto min-h-[calc(100dvh-20rem)] font-jetbrains">
				{children}
			</main>
			<footer className="px-5 mb-24">
				<SuperHero />
			</footer>
			<Nav />
		</>
	);
}
