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
import { Link, useNavigate } from "@tanstack/react-router";

const ProfileAvatar = () => {
	const navigate = useNavigate();
	// const { user, logout, login } = useAuthContext();
	// console.log('user:', user)
	const user = null;

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
				{!user && (
					<DropdownMenuItem className="hover:cursor-pointer" onClick={() => navigate({ to: "/auth/sign-in" })}>
						Sign In
					</DropdownMenuItem>
				)}

				{/* {user && (
					<>
						<DropdownMenuItem asChild>
							<Link to="/settings/profile">Profile</Link>
						</DropdownMenuItem>
						<DropdownMenuSeparator />
						<DropdownMenuItem onClick={() => logout()}>Logout</DropdownMenuItem>
					</>
				)} */}
			</DropdownMenuContent>
		</DropdownMenu>
	);
};

export default ProfileAvatar;
