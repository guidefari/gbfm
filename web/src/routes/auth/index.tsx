import { GenericAuthForm } from "@/components/Auth/GenericForm";
import { constructSignInUrl } from "@/lib/http";
import { Link, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/auth/")({
	component: Component,
});

function Component() {
	const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		const formData = new FormData(event.currentTarget);
		const formObject = Object.fromEntries(formData);

		// zod assert that formObject.email is a valid email

		try {
			location.href = constructSignInUrl(formObject?.email.toString());
		} catch (err) {
			// setError("Failed to register user")
		}
	};

	return (
		<div className="flex flex-col items-center justify-center min-h-screen">
			<h1 className="text-2xl font-bold mb-4">Auth</h1>
			<div className="space-y-2">
				<Link to="/auth/sign-in" className="text-blue-600 underline">
					Sign In
				</Link>
				<Link to="/auth/sign-up" className="text-blue-600 underline">
					Sign Up
				</Link>
				<Link to="/auth/forgot-password" className="text-blue-600 underline">
					Forgot Password?
				</Link>
			</div>
			<GenericAuthForm
				formTitle="Sign in"
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
			/>
		</div>
	);
}
