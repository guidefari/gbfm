import { GenericAuthForm } from "@/components/Auth/GenericForm";
import { createFileRoute } from "@tanstack/react-router";
import { VPS_BASE_URL } from "@/lib/http";
import { useState } from "react";

export const Route = createFileRoute("/auth/forgot-password")({
	component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
	const [message, setMessage] = useState<string>("");
	const [error, setError] = useState<string>("");

	const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		const formData = new FormData(event.currentTarget);
		const email = formData.get("email") as string;

		try {
			const response = await fetch(`${VPS_BASE_URL}/auth/forgot-password`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({ email }),
			});

			const data = await response.json();

			if (response.ok) {
				setMessage("Password reset email sent! Check your inbox.");
				setError("");
			} else {
				setError(data.error || "Failed to send reset email");
				setMessage("");
			}
		} catch (err) {
			setError("Failed to send reset email");
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
					formTitle="I Forgot My Password"
					fields={[
						{
							name: "email",
							label: "Email",
							type: "email",
							placeholder: "name@example.com",
							required: true,
						},
					]}
					onSubmit={onSubmit}
					submitButtonText="Send Reset Email"
				/>
			</div>
		</div>
	);
}