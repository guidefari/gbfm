"use client";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuthContext } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";

const ProfileAvatar = () => {
	const { user, onSignOut } = useAuthContext();

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
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
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end">
				{!user?.id && (
					<>
						<Link to="/auth">
							<DropdownMenuItem className="hover:cursor-pointer">
								Sign In
							</DropdownMenuItem>
						</Link>
						<DropdownMenuSeparator />
					</>
				)}

				<DropdownMenuItem asChild>
					<Link to="/settings/profile">Profile</Link>
				</DropdownMenuItem>
				<DropdownMenuItem>Support</DropdownMenuItem>
				<DropdownMenuSeparator />
				<DropdownMenuItem onClick={onSignOut}>Logout</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
};

export default ProfileAvatar;
