import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/ui/button";
import Link from "next/link";
import React from "react";
import { MenuIcon } from "../common/icons";
import { pagesAndPages } from "./NavLinks";
import ProfileAvatar from "./ProfileAvatar";

export const MobileNav = () => {
	const [open, setOpen] = React.useState(false);

	return (
		<Sheet open={open} onOpenChange={setOpen}>
			<SheetTrigger asChild>
				<Button
					onClick={() => setOpen(true)}
					size="icon"
					variant="default"
					className="sm:hidden"
				>
					<MenuIcon className="h-5 w-5" />
					<span className="sr-only">Toggle Menu</span>
				</Button>
			</SheetTrigger>
			<SheetContent
				side="left"
				className="sm:max-w-xs flex flex-col space-between"
			>
				<nav className="grid gap-6 text-lg font-medium">
					{pagesAndPages.map((page) => {
						if (page.customComponent) {
							return (
								<div className="flex items-center gap-4 text-muted-foreground hover:text-foreground">
									{page.customComponent}
									{page.name}
								</div>
							);
						}

						return (
							<Link
								key={page.slug}
								href={page.slug}
								onClick={() => setOpen(false)}
								prefetch={false}
								className="flex items-center gap-4 text-muted-foreground hover:text-foreground"
							>
								{page.icon}
								{page.name}
							</Link>
						);
					})}
				</nav>
				<div className="">
					<ProfileAvatar />
				</div>
			</SheetContent>
		</Sheet>
	);
};
