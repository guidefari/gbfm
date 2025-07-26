import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useUserLOL, VPS_BASE_URL } from "@/lib/http";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useAuthStore } from "@/store/auth";

export const Route = createFileRoute("/settings/profile")({
	component: Profile,
});

export default function Profile() {
	const { accessToken } = useAuthStore();
	const { data: user } = useUserLOL();


	const [imagePreview, setImagePreview] = useState<string>(
		user?.avatarUrl || "/placeholder.svg",
	);
	const [selectedFile, setSelectedFile] = useState<File | null>(null);
	const [isSubmitting, setIsSubmitting] = useState(false);

	const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
		const file = event.target.files?.[0];
		if (file) {
			setSelectedFile(file);
			const reader = new FileReader();
			reader.onloadend = () => {
				setImagePreview(reader.result as string);
			};
			reader.readAsDataURL(file);
		}
	};

	const fields = [
		{
			name: "username",
			label: "Username",
			type: "text",
			placeholder: user?.username || "Silly Goose",
			value: user?.username || "",
		},
		{
			name: "email",
			label: "Email",
			type: "email",
			placeholder: user?.email || "silly@goose.fm",
			value: user?.email || "",
		},
		// {
		// 	name: "password",
		// 	label: "Password",
		// 	type: "password",
		// 	placeholder: "••••••••",
		// 	value: "",
		// },
	];

	const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		if (!user?.id) return;

		setIsSubmitting(true);

		try {
			const formData = new FormData(e.currentTarget);

			if (selectedFile) {
				formData.append("avatar", selectedFile);
			}

			const response = await fetch(`${VPS_BASE_URL}/auth/profile`, {
				method: "PATCH",
				body: formData,
				headers: {
					Authorization: `Bearer ${accessToken}`,
					// "Content-Type": "application/json",
				},
			});

			if (!response.ok) {
				const errorData = await response.json();
				throw new Error(errorData.error || "Failed to update profile");
			}

			const data = await response.json();
			console.log("Profile updated successfully:", data);

			setSelectedFile(null);
		} catch (error) {
			console.error("Error updating profile:", error);
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<div className="flex min-h-[65dvh] flex-col items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
			<div className="mx-auto space-y-8 w-full max-w-md">
				<div className="flex flex-col justify-center items-center space-y-2">
					<div className="inline-flex items-center px-3 py-1 text-sm font-medium rounded-full bg-primary text-primary-foreground">
						Profile management
					</div>
				</div>
				<Card>
					<CardContent className="space-y-4">
						<form onSubmit={onSubmit}>
							<div className="flex justify-center mb-6">
								<div className="relative mr-4 w-20 h-20 rounded-full group">
									<img
										src={user?.avatarUrl || imagePreview}
										alt="User Avatar"
										className="rounded-full cursor-pointer"
										width={80}
										height={80}
									/>
									<label
										htmlFor="avatar"
										className="hidden absolute right-0 bottom-0 px-2 py-1 text-xs rounded-full cursor-pointer group-hover:flex bg-gb-darker-bg"
									>
										Change
										<input
											id="avatar"
											type="file"
											accept="image/*"
											className="hidden"
											onChange={handleImageChange}
										/>
									</label>
								</div>
								{selectedFile && (
									<div className="self-end mb-2 text-xs text-muted-foreground">
										Avatar will be saved with profile
									</div>
								)}
							</div>

							<div className="grid gap-2">
								{fields.map((field) => (
									<div className="grid gap-1" key={field.name}>
										<div className="flex justify-between items-center">
											<Label htmlFor={field.name}>{field.label}</Label>
										</div>
										<Input
											id={field.name}
											type={field.type}
											placeholder={field.placeholder}
											name={field.name}
											defaultValue={field.value}
										/>
									</div>
								))}
								<Button
									type="submit"
									className="w-full"
									disabled={isSubmitting}
								>
									{isSubmitting ? "Saving..." : "Save Profile"}
								</Button>
							</div>
						</form>
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
