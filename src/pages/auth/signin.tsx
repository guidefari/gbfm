"use client";
import { type FormField, GenericAuthForm } from "@/components/Auth/GenericForm";
import { LockIcon } from "@/components/common/icons";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuthContext } from "@/src/contexts/AuthContext";
import Link from "next/link";
import { useRouter } from "next/router";
import { useState } from "react";

export default function SignIn() {
	const router = useRouter();
	// const [email, setEmail] = useState<string>("");
	// const [password, setPassword] = useState<string>("");
	const [error, setError] = useState("");
	const { onSignIn } = useAuthContext();

	const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();

		const formData = new FormData(event.currentTarget);
		const email = formData.get("email") as string;
		const password = formData.get("password") as string;

		try {
			const form = { email, password };
			const response = await fetch("/api/auth/login", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(form),
			});
			// if (!response.ok) {
			// 	setError("Failed to authenticate user");
			// 	return;
			// }
			const data = await response.json();
			onSignIn(data);
			if (data?.token) {
				router.push("/");
			} else {
				setError("Failed to authenticate user");
			}
		} catch (err) {
			setError("Failed to authenticate user");
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
		<div>
			<GenericAuthForm
				fields={fields}
				onSubmit={onSubmit}
				formTitle="Sign In"
			/>
			<ul className="text-sm font-medium text-muted-foreground">
				<li>
					<Link href="/auth/signup">Create a new account</Link>
				</li>
				<li>
					<Link href="/auth/reset-password">Forgot password?</Link>
				</li>
			</ul>
		</div>
	);
}
