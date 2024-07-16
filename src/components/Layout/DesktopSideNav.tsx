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
import { pagesAndPages } from "./NavLinks";
import ProfileAvatar from "./ProfileAvatar";

export const DesktopSideNav = () => {
	return (
		<aside className="fixed inset-y-0 left-0 z-10 hidden w-14 flex-col bg-gb-darker-bg sm:flex">
			<nav className="flex flex-col items-center gap-4 px-2 sm:py-5">
				{pagesAndPages.map((page) => {
					if (page.customComponent) {
						return page.customComponent;
					}
					return (
						<TooltipProvider key={page.name}>
							<Tooltip>
								<TooltipTrigger asChild>
									<Link
										href={page.slug}
										className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:text-foreground md:h-8 md:w-8"
										prefetch={false}
									>
										{page.icon}
										<span className="sr-only">{page.name}</span>
									</Link>
								</TooltipTrigger>
								<TooltipContent side="right">{page.name}</TooltipContent>
							</Tooltip>
						</TooltipProvider>
					);
				})}
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
