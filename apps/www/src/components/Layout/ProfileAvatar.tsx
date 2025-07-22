"use client";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuthStore } from "@/store/auth";
import { Link, useNavigate } from "@tanstack/react-router";

const ProfileAvatar = () => {
	const navigate = useNavigate();
	const { user, isAuthenticated, clearAuth } = useAuthStore();

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button
					variant="outline"
					size="icon"
					className="overflow-hidden rounded-full"
				>
					{/* {user} */}
					{/* <img
						src="/fav.png"
						width={36}
						height={36}
						alt="Avatar"
						className="overflow-hidden rounded-full"
					/> */}
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end">
				{!isAuthenticated ? (
					<DropdownMenuItem
						className="hover:cursor-pointer"
						onClick={() => navigate({ to: "/auth/sign-in" })}
					>
						Sign In
					</DropdownMenuItem>
				) : (
					<>
						<DropdownMenuItem asChild>
							<Link to="/settings/profile">Profile</Link>
						</DropdownMenuItem>
						<DropdownMenuSeparator />
						<DropdownMenuItem onClick={() => clearAuth()}>
							Logout
						</DropdownMenuItem>
					</>
				)}
			</DropdownMenuContent>
		</DropdownMenu>
	);
};

export default ProfileAvatar;
