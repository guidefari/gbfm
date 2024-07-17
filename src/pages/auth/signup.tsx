"use client";
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

	return (
		<div className="flex flex-col justify-center min-h-full px-6 py-12 lg:px-8">
			<div className="mt-10 sm:mx-auto sm:w-full sm:max-w-sm">
				<form className="space-y-6" onSubmit={onSubmit}>
					<div>
						<label
							htmlFor="email"
							className="block text-sm font-medium leading-6 text-gray-900"
						>
							Email address
						</label>
						<div className="mt-2">
							<input
								id="email"
								name="email"
								type="email"
								autoComplete="email"
								required
								className="block w-full rounded-md border-0 py-1.5 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
								// value={email}
								// onChange={(e) => setEmail(e.target.value || "")}
							/>
						</div>
					</div>
					<div>
						<div className="flex items-center justify-between">
							<label
								htmlFor="password"
								className="block text-sm font-medium leading-6 text-gray-900"
							>
								Password
							</label>
							<div className="text-sm">
								<Link
									href="/auth/forgot"
									className="font-semibold text-indigo-600 hover:text-indigo-500"
								>
									Forgot password?
								</Link>
							</div>
						</div>
						<div className="mt-2">
							<input
								id="password"
								name="password"
								type="password"
								autoComplete="current-password"
								required
								className="block w-full rounded-md border-0 py-1.5 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
								// value={password}
								// onChange={(e) => setPassword(e.target.value || "")}
							/>
						</div>
					</div>
					<div>
						<button
							type="submit"
							className="flex w-full justify-center rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-semibold leading-6 text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
						>
							Sign up
						</button>
					</div>
				</form>
			</div>
		</div>
	);
}

export default SignUp;
