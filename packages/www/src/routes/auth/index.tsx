import { GenericAuthForm } from "@/components/Auth/GenericForm";
import {
	createFileRoute,
	redirect,
	useNavigate,
	useRouter,
} from "@tanstack/react-router";
import { signin } from "@/lib/http";
import { toast } from "@/components/ui/use-toast";

export const Route = createFileRoute("/auth/")({
	component: Component,
});

function Component() {
	const { navigate } = useRouter();

	const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		const formData = new FormData(event.currentTarget);
		const formObject = Object.fromEntries(formData);

		// zod assert that formObject.email is a valid email

		try {
			const redirectUrl = signin(formObject?.email.toString());
			const response = await fetch(redirectUrl);
			if (response.redirected) {
				navigate({ to: "/auth/verify" });
			}
			console.log("response:", response);

			// console.log("redirectUrl:", redirectUrl);
			// navigate({ to: redirectUrl });
			// return redirect({ to: redirectUrl });

			// const response = await fetch("/api/auth/signup", {
			//   method: "POST",
			//   headers: { "Content-Type": "application/json" },
			//   body: JSON.stringify(formObject),
			// });
			// console.log("response:", response.json());
			// if (!response.ok) {
			//   // setError("Failed to register user");
			//   const r = await response.json();
			//   toast({
			//     title: "Failed to register user",
			//     description: r.message || "",
			//     variant: "destructive",
			//   });
			//   return;
			// }
			// const data = await response.json();
			// console.log("data:", data);
			// onSignUp({
			//   id: data?.id,
			//   email: data?.email,
			//   username: data?.username,
			// });
			// router.push("/settings/profile");
		} catch (err) {
			// setError("Failed to register user")
		}
	};

	return (
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
	);
}
