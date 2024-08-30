import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuthContext } from "@/contexts/AuthContext";
import { getUser, validateLoginState } from "@/services/auth";
import { readFromLocalStorage } from "@guide/utils";
import type { User } from "lucia";
import type { GetServerSidePropsContext } from "next";

interface ProfileProps {
	user: User; // Make sure to import the User type if needed
}

export default async function Profile() {
	// const { user } = useAuthContext();
	const user = await getUser();
	console.log("user:", user);
	if (!user) {
		return {
			redirect: {
				destination: "/auth/signin",
				permanent: false,
			},
		};
	}

	const fields = [
		{
			name: "username",
			label: "Username",
			type: "text",
			// placeholder: user?.username || "Silly Goose",
			placeholder: "Silly Goose",
		},
		{
			name: "email",
			label: "Email",
			type: "email",
			// placeholder: user?.email || "silly@goose.fm",
			placeholder: "silly@goose.fm",
		},
		{
			name: "password",
			label: "Password",
			type: "password",
			placeholder: "••••••••",
		},
	];

	const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
		"use server";
		e.preventDefault();

		const formData = new FormData(e.currentTarget);
		const email = formData.get("email") as string;
		const password = formData.get("password") as string;
		const username = formData.get("username") as string;

		try {
			const token = readFromLocalStorage({
				id: "login_token",
				tableName: "goosebumps",
			});
			const response = await fetch("/api/auth/update-profile", {
				method: "POST",
				body: JSON.stringify({
					username,
					email,
					password,
					id: user?.id,
				}),
				headers: {
					Authorization: `Bearer ${token}`,
				},
			});
			const data = await response.json();
			console.log(data);
		} catch (error) {
			console.error(error);
		}

		console.log("Form submitted");
	};

	return (
		<div className="flex min-h-[65dvh] flex-col items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
			<div className="w-full max-w-md mx-auto space-y-8">
				<div className="flex flex-col items-center justify-center space-y-2">
					<div className="inline-flex items-center px-3 py-1 text-sm font-medium rounded-full bg-primary text-primary-foreground">
						Profile management
					</div>
				</div>
				<Card>
					<CardContent className="space-y-4">
						<form onSubmit={onSubmit}>
							<div className="flex justify-center mb-6">
								<div className="relative w-20 h-20 mr-4 rounded-full group">
									<img
										src="/placeholder.svg"
										alt="User Avatar"
										className="rounded-full cursor-pointer"
										width={80}
										height={80}
									/>
									<label
										htmlFor="avatar"
										className="absolute bottom-0 right-0 hidden px-2 py-1 text-xs rounded-full cursor-pointer group-hover:flex bg-gb-darker-bg"
									>
										Change
										<input id="avatar" type="file" className="hidden" />
									</label>
								</div>
							</div>

							<div className="grid gap-2">
								{fields.map((field) => (
									<div className="grid gap-1" key={field.name}>
										<div className="flex items-center justify-between">
											<Label htmlFor={field.name}>{field.label}</Label>
										</div>
										<Input
											id={field.name}
											type={field.type}
											placeholder={field.placeholder}
											required
											name={field.name}
										/>
									</div>
								))}
								<Button type="submit" className="w-full">
									Save
								</Button>
							</div>
						</form>
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
