import type React from "react";
import Nav from "@/components/Nav";
import { DesktopSideNav } from "./DesktopSideNav";
import { MobileNav } from "./MobileNav";
import ProfileAvatar from "./ProfileAvatar";

type Props = {
	children: React.ReactNode;
};

export default function AppShell({ children }: Props) {
	return (
		<div className="flex w-full min-h-screen">
			<DesktopSideNav />
			<div className="flex flex-col flex-grow sm:gap-4 sm:py-4 sm:pl-14">
				<header className="sticky top-0 z-30 flex items-center justify-between gap-4 px-4 h-14 sm:static sm:h-auto sm:bg-transparent sm:px-6">
					<MobileNav />
					<div className="flex justify-center sm:hidden">
						<ProfileAvatar />
					</div>
					{/* searrrrch */}
					{/* <div className="relative flex-1 ml-auto md:grow-0">
						<SearchIcon className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
						<Input
							type="search"
							placeholder="Search..."
							className="w-full rounded-lg bg-background pl-8 md:w-[200px] lg:w-[336px]"
						/>
					</div> */}
				</header>
				<main className="flex-1 px-4 sm:px-6 md:px-8 lg:px-10">
					{children}
				</main>
				<footer className="px-5">
					<div className="container flex flex-col w-full px-1 pt-4 mx-auto mb-4 leading-none border-gray-200 sm:mb-0 lg:px-5 lg:pt-10">
						<h1 className="my-0 text-5xl font-bold text-right md:text-8xl xl:text-9xl">
							goosebumps.
							<br />
							<span className="text-highlight">fm</span>
						</h1>
					</div>
				</footer>
				<Nav />
			</div>
		</div>
	);
}
