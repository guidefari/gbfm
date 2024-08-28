"use client";
import { type FormField, GenericAuthForm } from "@/components/Auth/GenericForm";
import { useAuthContext } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import React from "react";

function SignUp() {
	const router = useRouter();
	const { onSignUp } = useAuthContext();
	const [error, setError] = React.useState("");

	const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		const formData = new FormData(event.currentTarget);
		const email = formData.get("email") as string;
		const password = formData.get("password") as string;

		try {
			const form = { email, password };
			const response = await fetch("/api/auth/reset-password", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(form),
			});
			const data = await response.json();

			router.push("/");
		} catch (err) {
			setError("Failed to reset password");
		}
	};

	const fields: FormField[] = [
		{
			label: "Email",
			name: "email",
			type: "email",
			placeholder: "silly@goose.fm",
		},
	];

	return (
		<div className="">
			<GenericAuthForm
				fields={fields}
				onSubmit={onSubmit}
				formTitle="Reset Password"
			/>
		</div>
	);
}

export default SignUp;
