import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import Link from "next/link";
import React from "react";
import {
	BriefcaseIcon,
	FileTextIcon,
	HomeIcon,
	MailIcon,
	MountainIcon,
	SettingsIcon,
	UserIcon,
} from "../common/icons";
import ProfileAvatar from "./ProfileAvatar";

export const DesktopSideNav = () => {
	return (
		<aside className="fixed inset-y-0 left-0 z-10 hidden w-14 flex-col border-r bg-background sm:flex">
			<nav className="flex flex-col items-center gap-4 px-2 sm:py-5">
				<TooltipProvider>
					<Link
						href="#"
						className="group flex h-9 w-9 shrink-0 items-center justify-center gap-2 rounded-full bg-primary text-lg font-semibold text-primary-foreground md:h-8 md:w-8 md:text-base"
						prefetch={false}
					>
						<MountainIcon className="h-4 w-4 transition-all group-hover:scale-110" />
						<span className="sr-only">Acme Inc</span>
					</Link>
					<Tooltip>
						<TooltipTrigger asChild>
							<Link
								href="#"
								className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:text-foreground md:h-8 md:w-8"
								prefetch={false}
							>
								<HomeIcon className="h-5 w-5" />
								<span className="sr-only">Home</span>
							</Link>
						</TooltipTrigger>
						<TooltipContent side="right">Home</TooltipContent>
					</Tooltip>
					<Tooltip>
						<TooltipTrigger asChild>
							<Link
								href="#"
								className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:text-foreground md:h-8 md:w-8"
								prefetch={false}
							>
								<UserIcon className="h-5 w-5" />
								<span className="sr-only">About</span>
							</Link>
						</TooltipTrigger>
						<TooltipContent side="right">About</TooltipContent>
					</Tooltip>
					<Tooltip>
						<TooltipTrigger asChild>
							<Link
								href="#"
								className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:text-foreground md:h-8 md:w-8"
								prefetch={false}
							>
								<BriefcaseIcon className="h-5 w-5" />
								<span className="sr-only">Services</span>
							</Link>
						</TooltipTrigger>
						<TooltipContent side="right">Services</TooltipContent>
					</Tooltip>
					<Tooltip>
						<TooltipTrigger asChild>
							<Link
								href="#"
								className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:text-foreground md:h-8 md:w-8"
								prefetch={false}
							>
								<MailIcon className="h-5 w-5" />
								<span className="sr-only">Contact</span>
							</Link>
						</TooltipTrigger>
						<TooltipContent side="right">Contact</TooltipContent>
					</Tooltip>
					<Tooltip>
						<TooltipTrigger asChild>
							<Link
								href="#"
								className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:text-foreground md:h-8 md:w-8"
								prefetch={false}
							>
								<FileTextIcon className="h-5 w-5" />
								<span className="sr-only">Blog</span>
							</Link>
						</TooltipTrigger>
						<TooltipContent side="right">Blog</TooltipContent>
					</Tooltip>
				</TooltipProvider>
			</nav>
			<nav className="mt-auto flex flex-col items-center gap-4 px-2 sm:py-5">
				<TooltipProvider>
					<Tooltip>
						<TooltipTrigger asChild>
							<Link
								href="#"
								className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:text-foreground md:h-8 md:w-8"
								prefetch={false}
							>
								<SettingsIcon className="h-5 w-5" />
								<span className="sr-only">Settings</span>
							</Link>
						</TooltipTrigger>
						<TooltipContent side="right">Settings</TooltipContent>
					</Tooltip>
				</TooltipProvider>
				<ProfileAvatar />
			</nav>
		</aside>
	);
};
