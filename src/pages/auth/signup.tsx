"use client";
import { type FormField, GenericAuthForm } from "@/components/Auth/GenericForm";
import { useAuthContext } from "@/src/contexts/AuthContext";
import type { PocketBaseSignUpResponse } from "@/src/types/auth";
import Link from "next/link";
import { useRouter } from "next/router";
import React from "react";

function SignUp() {
	const router = useRouter();
	// const [email, setEmail] = React.useState<string>("");
	// const [password, setPassword] = React.useState<string>("");
	const { onSignUp } = useAuthContext();
	const [error, setError] = React.useState("");

	const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		const formData = new FormData(event.currentTarget);
		const email = formData.get("email") as string;
		const password = formData.get("password") as string;

		try {
			const form = { email, password };
			const response = await fetch("/api/auth/signup", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(form),
			});
			// console.log("response:", response.json());
			// if (!response.ok) {
			// 	setError("Failed to register user");
			// 	return;
			// }
			const data = await response.json();
			console.log("data:", data);
			onSignUp({
				id: data.id,
				email,
				username: data.username,
				avatarUrl: data.avatar,
			});
			router.push("/");
		} catch (err) {
			setError("Failed to register user");
		}
	};

	const fields: FormField[] = [
		{
			label: "Email",
			name: "email",
			type: "email",
			placeholder: "m@example.com",
		},
		{
			label: "Password",
			name: "password",
			type: "password",
			placeholder: "••••••••",
		},
	];

	return (
		<div className="">
			<GenericAuthForm
				fields={fields}
				onSubmit={onSubmit}
				formTitle="Sign Up"
			/>
		</div>
	);
}

export default SignUp;
