"use client";

import { Headphones, LockKeyhole, LogOut, User } from "lucide-react";
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
import { useAuthStore } from "@/store/auth";
import { useNavigate } from "@tanstack/react-router";

export function CommandDialogDemo() {
	const router = useNavigate();
	const { commando, openCommando, closeCommando, toggleCommando } =
		useUIStore();
	const { isAuthenticated, clearAuth } = useAuthStore();

	const routeToMixes = React.useCallback(() => {
		router({ to: "/mixes" });
		closeCommando();
	}, [router, closeCommando]);

	const routeToLogin = React.useCallback(() => {
		router({ to: "/auth/sign-in" });
		closeCommando();
	}, [router, closeCommando]);

	const routeToProfile = React.useCallback(() => {
		router({ to: "/settings/profile" });
		closeCommando();
	}, [router, closeCommando]);

	// biome-ignore lint/correctness/useExhaustiveDependencies: 👀
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
	}, []);

	return (
		<>
			<CommandDialog
				open={commando.isOpen}
				onOpenChange={(open) => (open ? openCommando() : closeCommando())}
				title="Command palette for GBFM"
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
						{!isAuthenticated && (
							<CommandItem onSelect={routeToLogin}>
								<LockKeyhole />
								<span>Login</span>
							</CommandItem>
						)}
					</CommandGroup>
					<CommandSeparator />
					{isAuthenticated && (
						<CommandGroup heading="Settings">
							<CommandItem onSelect={routeToProfile}>
								<User />
								<span>Profile</span>
								<CommandShortcut>⌘P</CommandShortcut>
							</CommandItem>

							<CommandItem onSelect={clearAuth}>
								<LogOut />
								<span>Logout</span>
								<CommandShortcut>⌘L</CommandShortcut>
							</CommandItem>
						</CommandGroup>
					)}
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
