import type React from "react";
import Nav from "../Nav";
import { SideNav } from "../SideNav";

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
			<footer className="px-5">
				<div className="w-full px-1 pt-4 mb-4 leading-none border-gray-200 sm:mb-0 container flex flex-col mx-auto lg:px-5 lg:pt-10">
					<h1 className="my-0 text-5xl font-bold text-right md:text-8xl xl:text-9xl">
						goosebumps.
						<br />
						<span className="text-highlight">fm</span>
					</h1>
				</div>
			</footer>
			<Nav />
		</>
	);
}
