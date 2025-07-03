import { GenericAuthForm } from "@/components/Auth/GenericForm";
import { VPS_BASE_URL } from "@/lib/http";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

export const Route = createFileRoute("/auth/sign-up")({
	component: SignUpPage,
});

function SignUpPage() {
	const [message, setMessage] = useState("");
	const [error, setError] = useState("");
	const navigate = Route.useNavigate();

	const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		const formData = new FormData(event.currentTarget);
		const email = formData.get("email");
		const password = formData.get("password");
		const username = formData.get("username");

		try {
			const response = await fetch(`${VPS_BASE_URL}/auth/signup`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({ email, password, username }),
			});

			const data = await response.json();

			if (response.ok) {
				setMessage("Sign up successful! Redirecting to sign in...");
				setError("");
				setTimeout(() => {
					navigate({ to: "/auth/sign-in" });
				}, 1500);
			} else {
				setError(data.error || "Failed to sign up");
				setMessage("");
			}
		} catch (err) {
			setError("Failed to sign up");
			setMessage("");
		}
	};

	return (
		<div className="">
			<div className="mx-auto space-y-8 w-full max-w-md">
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
					formTitle="Sign Up"
					fields={[
						{
							name: "email",
							label: "Email",
							type: "email",
							placeholder: "name@example.com",
							required: true,
						},
						{
							name: "username",
							label: "Username",
							type: "text",
							placeholder: "Enter your username",
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
					submitButtonText="Sign Up"
				/>
				<div className="text-center">
					<p className="text-sm text-gray-500">
						Already have an account? <Link to="/auth/sign-in">Sign in</Link>
					</p>
					<p className="text-sm text-gray-500">
						Forgot password? <Link to="/auth/forgot-password">Reset here</Link>
					</p>
				</div>
			</div>
		</div>
	);
}

export default SignUpPage;
