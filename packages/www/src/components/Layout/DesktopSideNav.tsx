import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { pagesAndPages } from "./NavLinks";
import ProfileAvatar from "./ProfileAvatar";
import { Link } from "@tanstack/react-router";

export const DesktopSideNav = () => {
	return (
		<aside className="fixed inset-y-0 left-0 z-10 flex-col hidden w-14 bg-gb-darker-bg sm:flex">
			<nav className="flex flex-col items-center gap-4 px-2 sm:py-5">
				{pagesAndPages.map((page) => {
					if (page.CustomComponent) {
						return <div key={page.name}>{page.CustomComponent}</div>;
					}
					return (
						<TooltipProvider key={page.name}>
							<Tooltip>
								<TooltipTrigger asChild>
									<Link
										to={page.slug}
										className="flex items-center justify-center transition-colors rounded-lg h-9 w-9 text-muted-foreground hover:text-foreground md:h-8 md:w-8"
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
			<nav className="flex flex-col items-center gap-4 px-2 mt-auto sm:py-5">
				<ProfileAvatar />
			</nav>
		</aside>
	);
};
