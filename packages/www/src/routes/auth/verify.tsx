import {
	InputOTP,
	InputOTPGroup,
	InputOTPSlot,
} from "@/components/ui/input-otp";
import { constructAuthCallbackUrl } from "@/lib/http";
import { createFileRoute } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { useEffect } from "react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import {
	FormField,
	Form,
	FormItem,
	FormLabel,
	FormControl,
	FormMessage,
} from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Icons } from "@/components/common/icons";
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardTitle,
} from "@/components/ui/card";

export const Route = createFileRoute("/auth/verify")({
	component: VerifyPage,
});

const FormSchema = z.object({
	code: z.string().min(6, {
		message: "Your verification code must be 6 characters.",
	}),
});

export function VerifyPage() {
	const { error, email } = Route.useSearch<{
		error: string;
		email: string;
	}>();

	const form = useForm<z.infer<typeof FormSchema>>({
		resolver: zodResolver(FormSchema),
		defaultValues: {
			code: "",
		},
	});

	const isBusy =
		form.formState.isLoading ||
		form.formState.isSubmitting ||
		form.formState.isSubmitSuccessful;

	// biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
	useEffect(() => {
		if (error === "invalid_code")
			form.setError("code", {
				type: "custom",
				message: "The code is invalid, try again.",
			});
	}, [error]);

	async function onSubmit(data: z.infer<typeof FormSchema>) {
		const authCallbackUrl = constructAuthCallbackUrl(data.code);
		location.href = authCallbackUrl;
		return;
	}

	return (
		<Form
			className="flex min-h-[65dvh] flex-col items-center justify-center px-4 py-12 sm:px-6 lg:px-8"
			{...form}
			onSubmit={onSubmit}
		>
			<Card className="w-full max-w-md px-8">
				<CardTitle>Verification Code</CardTitle>
				<CardDescription>
					Enter the verification code sent to {email}
				</CardDescription>
				<CardContent>
					<FormField
						control={form.control}
						name="code"
						render={({ field }) => (
							<FormItem className="flex flex-col items-center my-auto">
								<FormLabel className="sr-only">Verification Code</FormLabel>
								<FormControl>
									<InputOTP maxLength={6} disabled={isBusy} {...field}>
										<InputOTPGroup>
											<InputOTPSlot index={0} />
											<InputOTPSlot index={1} />
											<InputOTPSlot index={2} />
											<InputOTPSlot index={3} />
											<InputOTPSlot index={4} />
											<InputOTPSlot index={5} />
										</InputOTPGroup>
									</InputOTP>
								</FormControl>
								<FormMessage />
							</FormItem>
						)}
					/>
				</CardContent>

				<CardFooter>
					<Button type="submit" className="w-full" disabled={isBusy}>
						{isBusy && <Icons.spinner className="w-4 h-4 mr-2 animate-spin" />}
						Submit
					</Button>
				</CardFooter>
			</Card>
		</Form>
	);
}
