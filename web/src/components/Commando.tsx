"use client";

import {
	Calculator,
	CreditCard,
	Headphones,
	LockKeyhole,
	Settings,
	User,
} from "lucide-react";
import * as React from "react";
import { version } from "../../../package.json";

import {
	CommandDialog,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
	CommandSeparator,
	CommandShortcut,
} from "@/components/ui/command";
import { useUIStore } from "@/store";
import { useNavigate } from "@tanstack/react-router";

export function CommandDialogDemo() {
	const router = useNavigate();
	const { commando, openCommando, closeCommando, toggleCommando } =
		useUIStore();

	const routeToMixes = React.useCallback(() => {
		router({ to: "/mixes" });
		closeCommando();
	}, [router, closeCommando]);

	const routeToLogin = React.useCallback(() => {
		router({ to: "/auth/sign-in" });
		closeCommando();
	}, [router, closeCommando]);

	React.useEffect(() => {
		const down = (e: KeyboardEvent) => {
			if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
				e.preventDefault();
				toggleCommando();
			}

			if (e.key === "0") {
				e.preventDefault();
				routeToMixes();
			}
		};

		document.addEventListener("keydown", down);
		return () => document.removeEventListener("keydown", down);
	}, [toggleCommando, routeToMixes]);

	return (
		<>
			<CommandDialog
				open={commando.isOpen}
				onOpenChange={(open) => (open ? openCommando() : closeCommando())}
			>
				<CommandInput placeholder="Type a command or search..." />
				<CommandList>
					<CommandEmpty>No results found.</CommandEmpty>
					<CommandGroup heading="Suggestions">
						<CommandItem onSelect={routeToMixes}>
							<Headphones />
							<span>Mixes</span>
							<CommandShortcut>0</CommandShortcut>
						</CommandItem>
						<CommandItem onSelect={routeToLogin}>
							<LockKeyhole />
							<span>Login</span>
						</CommandItem>
						<CommandItem>
							<Calculator />
							<span>Calculator</span>
						</CommandItem>
					</CommandGroup>
					<CommandSeparator />
					<CommandGroup heading="Settings">
						<CommandItem>
							<User />
							<span>Profile</span>
							<CommandShortcut>⌘P</CommandShortcut>
						</CommandItem>
						<CommandItem>
							<CreditCard />
							<span>Billing</span>
							<CommandShortcut>⌘B</CommandShortcut>
						</CommandItem>
						<CommandItem>
							<Settings />
							<span>Settings</span>
							<CommandShortcut>⌘S</CommandShortcut>
						</CommandItem>
					</CommandGroup>
				</CommandList>
				<div className="flex justify-center items-center p-2 border-t">
					<a
						href={`https://github.com/guidefari/gbfm/releases/tag/v${version}`}
						target="_blank"
						rel="noopener noreferrer"
						className="text-xs transition-colors text-muted-foreground hover:text-foreground"
					>
						v{version}
					</a>
				</div>
			</CommandDialog>
		</>
	);
}
