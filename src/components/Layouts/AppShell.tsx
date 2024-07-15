import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

import Link from "next/link";
import type React from "react";
import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator,
} from "src/components/ui/breadcrumb";
import { Button } from "src/components/ui/button";
import Nav from "../Nav";
import { SideNav } from "../SideNav";
import {
	BriefcaseIcon,
	FileTextIcon,
	HomeIcon,
	MailIcon,
	MenuIcon,
	MountainIcon,
	SearchIcon,
	SettingsIcon,
	UserIcon,
} from "../common/icons";
import { DesktopSideNav } from "./DesktopSideNav";
import ProfileAvatar from "./ProfileAvatar";

type Props = {
	children: React.ReactNode;
};

export default function AppShell({ children }: Props) {
	return (
		<div className="flex min-h-screen w-full">
			<DesktopSideNav />
			<div className="flex flex-col sm:gap-4 sm:py-4 sm:pl-14 flex-grow">
				<header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-background px-4 sm:static sm:h-auto sm:border-0 sm:bg-transparent sm:px-6">
					<Sheet>
						<SheetTrigger asChild>
							<Button size="icon" variant="outline" className="sm:hidden">
								<MenuIcon className="h-5 w-5" />
								<span className="sr-only">Toggle Menu</span>
							</Button>
						</SheetTrigger>
						<SheetContent side="left" className="sm:max-w-xs">
							<nav className="grid gap-6 text-lg font-medium">
								<Link
									href="#"
									className="group flex h-10 w-10 shrink-0 items-center justify-center gap-2 rounded-full bg-primary text-lg font-semibold text-primary-foreground md:text-base"
									prefetch={false}
								>
									<MountainIcon className="h-5 w-5 transition-all group-hover:scale-110" />
									<span className="sr-only">Acme Inc</span>
								</Link>
								<Link
									href="#"
									className="flex items-center gap-4 px-2.5 text-muted-foreground hover:text-foreground"
									prefetch={false}
								>
									<HomeIcon className="h-5 w-5" />
									Home
								</Link>
								<Link
									href="#"
									className="flex items-center gap-4 px-2.5 text-muted-foreground hover:text-foreground"
									prefetch={false}
								>
									<UserIcon className="h-5 w-5" />
									About
								</Link>
								<Link
									href="#"
									className="flex items-center gap-4 px-2.5 text-muted-foreground hover:text-foreground"
									prefetch={false}
								>
									<BriefcaseIcon className="h-5 w-5" />
									Services
								</Link>
								<Link
									href="#"
									className="flex items-center gap-4 px-2.5 text-muted-foreground hover:text-foreground"
									prefetch={false}
								>
									<MailIcon className="h-5 w-5" />
									Contact
								</Link>
								<Link
									href="#"
									className="flex items-center gap-4 px-2.5 text-muted-foreground hover:text-foreground"
									prefetch={false}
								>
									<FileTextIcon className="h-5 w-5" />
									Blog
								</Link>
								<Link
									href="#"
									className="flex items-center gap-4 px-2.5 text-muted-foreground hover:text-foreground"
									prefetch={false}
								>
									<SettingsIcon className="h-5 w-5" />
									Settings
								</Link>
							</nav>
						</SheetContent>
					</Sheet>
					<Breadcrumb className="hidden md:flex">
						<BreadcrumbList>
							<BreadcrumbItem>
								<BreadcrumbLink asChild>
									<Link href="#" prefetch={false}>
										Home
									</Link>
								</BreadcrumbLink>
							</BreadcrumbItem>
							<BreadcrumbSeparator />
							<BreadcrumbItem>
								<BreadcrumbPage>Content</BreadcrumbPage>
							</BreadcrumbItem>
						</BreadcrumbList>
					</Breadcrumb>
					<div className="relative ml-auto flex-1 md:grow-0">
						<SearchIcon className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
						<Input
							type="search"
							placeholder="Search..."
							className="w-full rounded-lg bg-background pl-8 md:w-[200px] lg:w-[336px]"
						/>
					</div>
					<ProfileAvatar />
				</header>
				<main className="flex-1 px-4 py-8 sm:px-6 sm:py-10 md:px-8 md:py-12 lg:px-10 lg:py-16">
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
			</div>
		</div>
	);
}
