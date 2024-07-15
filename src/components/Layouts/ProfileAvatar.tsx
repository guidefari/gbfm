import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/ui/button";
import React from "react";

type Props = {
	title?: string;
};

const ProfileAvatar = ({ title = "" }: Props) => {
	return (
		<DropdownMenu>
			<DropdownMenuTrigger>
				<div className="flex items-center">
					<Button
						variant="outline"
						size="icon"
						className="overflow-hidden rounded-full"
					>
						<img
							src="/placeholder.svg"
							width={36}
							height={36}
							alt="Avatar"
							className="overflow-hidden rounded-full"
						/>
					</Button>
					{title && <span className="ml-2">{title}</span>}
				</div>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end">
				<DropdownMenuLabel>My Account</DropdownMenuLabel>
				<DropdownMenuSeparator />
				<DropdownMenuItem>Settings</DropdownMenuItem>
				<DropdownMenuItem>Support</DropdownMenuItem>
				<DropdownMenuSeparator />
				<DropdownMenuItem>Logout</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
};

export default ProfileAvatar;
