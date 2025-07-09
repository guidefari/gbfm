import Nav from "@/components/Nav";
import { cn } from "@/lib/utils";
import type React from "react";
import { Footer } from "./Footer";
// import { HorizontalMenu } from "./HorizontalMenu";
// import { DesktopSideNav } from "./DesktopSideNav";

type Props = {
	children: React.ReactNode;
	showFooter?: boolean;
};

export default function AppShell({ children, showFooter = true }: Props) {
	return (
		<div className="flex w-full min-h-dvh bg-background">
			{/* <DesktopSideNav /> */}
			<div
				className={cn(
					"flex flex-col flex-grow sm:gap-4",
					// todo: this is needed for the desktop side nav, if i decide to bring it back.
					// "sm:py-4 sm:pl-14"
				)}
			>
				{/* <HorizontalMenu /> */}
				<main className="z-10 flex-1 px-4 sm:px-6 md:px-8 lg:px-10 bg-background">
					{children}
				</main>
				{showFooter && <Footer />}
				<Nav />
			</div>
		</div>
	);
}
