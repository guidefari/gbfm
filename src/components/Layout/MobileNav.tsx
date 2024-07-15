import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/ui/button";
import Link from "next/link";
import React from "react";
import { MenuIcon } from "../common/icons";
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

export const MobileNav = () => {
	return (
		<Sheet>
			<SheetTrigger asChild>
				<Button size="icon" variant="default" className="sm:hidden">
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
					<div className="flex items-center gap-4 text-muted-foreground hover:text-foreground">
						<ProfileAvatar title="Profile Stuff" />
					</div>
				</nav>
			</SheetContent>
		</Sheet>
	);
};
