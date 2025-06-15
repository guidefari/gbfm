import { GenericAuthForm } from "@/components/Auth/GenericForm";
import { createFileRoute } from "@tanstack/react-router";
import { VPS_BASE_URL } from "@/lib/http";
import { useState } from "react";

export const Route = createFileRoute("/auth/sign-in")({
	component: SignInPage,
});

function SignInPage() {
	const [message, setMessage] = useState<string>("");
	const [error, setError] = useState<string>("");
	const navigate = Route.useNavigate();

	const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		const formData = new FormData(event.currentTarget);
		const email = formData.get("email") as string;
		const password = formData.get("password") as string;

		try {
			const response = await fetch(`${VPS_BASE_URL}/auth/signin`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({ email, password }),
			});

			const data = await response.json();

			if (response.ok) {
				setMessage("Sign in successful! Redirecting...");
				setError("");
				
				localStorage.setItem("accessToken", data.accessToken);
				localStorage.setItem("refreshToken", data.refreshToken);
				
				setTimeout(() => {
					navigate({ to: "/" });
				}, 1500);
			} else {
				setError(data.error || "Failed to sign in");
				setMessage("");
			}
		} catch (err) {
			setError("Failed to sign in");
			setMessage("");
		}
	};

	return (
		<div className="">
			<div className="w-full max-w-md mx-auto space-y-8">
				{message && (
					<div className="p-4 text-sm text-green-700 bg-green-100 rounded-md">
						{message}
					</div>
				)}
				
				{error && (
					<div className="p-4 text-sm text-red-700 bg-red-100 rounded-md">
						{error}
					</div>
				)}

				<GenericAuthForm
					formTitle="Sign In"
					fields={[
						{
							name: "email",
							label: "Email",
							type: "email",
							placeholder: "name@example.com",
							required: true,
						},
						{
							name: "password",
							label: "Password",
							type: "password",
							placeholder: "Enter your password",
							required: true,
						},
					]}
					onSubmit={onSubmit}
					submitButtonText="Sign In"
				/>
			</div>
		</div>
	);
}
