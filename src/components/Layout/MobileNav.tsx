import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import Link from "next/link";
import React from "react";
import { MenuIcon } from "../common/icons";
import { pagesAndPages } from "./NavLinks";
import { Button } from "@/components/ui/button";

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
					<MenuIcon className="w-5 h-5" />
					<span className="sr-only">Toggle Menu</span>
				</Button>
			</SheetTrigger>
			<SheetContent
				side="left"
				className="flex flex-col sm:max-w-xs space-between"
			>
				<nav className="grid gap-6 text-lg font-medium">
					{pagesAndPages.map((page) => {
						if (page.CustomComponent) {
							return (
								<div
									key={page.name}
									className="flex items-center gap-4 text-muted-foreground hover:text-foreground"
								>
									{page.CustomComponent}
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
			</SheetContent>
		</Sheet>
	);
};
