"use client";
import { type FormField, GenericAuthForm } from "@/components/Auth/GenericForm";
import { useToast } from "@/components/ui/use-toast";
import { useAuthContext } from "@/contexts/AuthContext";
import { useRouter } from "next/router";
import React from "react";

function SignUp() {
	const router = useRouter();
	const { onSignUp } = useAuthContext();
	const [error, setError] = React.useState("");
	const { toast } = useToast()

	const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		const formData = new FormData(event.currentTarget);
		const formObject = Object.fromEntries(formData);

		try {
			const response = await fetch("/api/auth/signup", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(formObject),
			});
			// console.log("response:", response.json());
			if (!response.ok) {
				// setError("Failed to register user");
				const r = await response.json()
				toast({
					title: "Failed to register user",
					description: r.message || "",
					variant: 'destructive'
				  })
				return;
			}
			const data = await response.json();
			console.log("data:", data);
			onSignUp({
				id: data?.id,
				email: data?.email,
				username: data?.username,
			});
			router.push("/settings/profile");
		} catch (err) {
			setError("Failed to register user");
		}
	};

	const fields: FormField[] = [
		{
			label: "Email",
			name: "email",
			type: "email",
			placeholder: "silly@goose.fm",
			required: true
		},
		{
			label: 'Username (optional)',
			name: "username",
			type: "text",
			placeholder: "big_cue"
		},
		{
			label: "Password",
			name: "password",
			type: "password",
			placeholder: "••••••••",
			required: true
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
