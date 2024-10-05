import { GenericAuthForm } from "@/components/Auth/GenericForm";
import { createFileRoute } from "@tanstack/react-router";
import { constructSignInUrl } from "@/lib/http";

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
		<>
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
		</>
	);
}
