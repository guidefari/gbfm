import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuthContext } from "@/contexts/AuthContext";
import { useState } from "react";
import { API_BASE_URL } from "@/lib/http";
// import { useEffect } from "react";

export const Route = createFileRoute("/settings/profile")({
	component: Profile,
});

export default function Profile() {
	const {  getToken, userData } = useAuthContext();
	const [imagePreview, setImagePreview] = useState<string>(userData?.avatarUrl || "/placeholder.svg");
	const [selectedFile, setSelectedFile] = useState<File | null>(null);

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

  const handleSaveImage = async () => {
    if (!selectedFile || !userData?.id) return;

    const token = await getToken();
    const formData = new FormData();
    formData.append('avatar', selectedFile);

    try {
      const response = await fetch(`${API_BASE_URL}/users/${userData.id}/avatar`, {
        method: 'PUT',
        body: formData,
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) throw new Error('Failed to upload image');
      
      // Handle successful upload
      console.log('Image uploaded successfully');
    } catch (error) {
      console.error('Error uploading image:', error);
    }
  };

	console.log('userData:', userData)
	// const token = getToken();
	// console.log('user:', user)

	// useEffect(() => {
	// 	const token = async () => {
	// 		const token = await getToken();
	// 		console.log('token:', token)
	// 	}
	// 	token();
	// }, [])
	
	// const user = await getUser();
	// if (!user) {
	// 	return {
	// 		redirect: {
	// 			destination: "/auth/signin",
	// 			permanent: false,
	// 		},
	// 	};
	// }

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
			placeholder: userData?.email || "silly@goose.fm",
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
		const token = await getToken();

		try {
			const response = await fetch(`${API_BASE_URL}/users`, {
				method: "PUT",
				body: JSON.stringify({
					username,
					email,
					password,
					id: userData?.id,
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
						{/* <p className="text-xs text-right">{userData?.id}</p> */}
						<form onSubmit={onSubmit}>
							<div className="flex justify-center mb-6">
								<div className="relative w-20 h-20 mr-4 rounded-full group">
									<img
										src={imagePreview}
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
									<Button
										type="button"
										onClick={handleSaveImage}
										variant="secondary"
										size="sm"
										className="self-end mb-2"
									>
										Save Avatar
									</Button>
								)}
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
