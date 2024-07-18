import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const fields = [
	{
		name: "username",
		label: "Username",
		type: "text",
		placeholder: "John Doe",
	},
	{
		name: "email",
		label: "Email",
		type: "email",
		placeholder: "john.doe@example.com",
	},
	{
		name: "password",
		label: "Password",
		type: "password",
		placeholder: "••••••••",
	},
];

export default function Profile() {
	const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		console.log("Form submitted");
	};

	return (
		<div className="flex min-h-[65dvh] flex-col items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
			<div className="w-full max-w-md mx-auto space-y-8">
				<div className="flex flex-col items-center justify-center space-y-2">
					<div className="inline-flex items-center px-3 py-1 text-sm font-medium rounded-full bg-primary text-primary-foreground">
						Profile management
					</div>
				</div>
				<Card>
					<CardContent className="space-y-4">
						<form onSubmit={onSubmit}>
							<div className="flex justify-center mb-6">
								<div className="relative w-20 h-20 mr-4 rounded-full group">
									<img
										src="/placeholder.svg"
										alt="User Avatar"
										className="rounded-full cursor-pointer"
										width={80}
										height={80}
									/>
									<label
										htmlFor="avatar"
										className="absolute bottom-0 right-0 hidden px-2 py-1 text-xs rounded-full cursor-pointer group-hover:flex bg-gb-darker-bg"
									>
										Change
										<input id="avatar" type="file" className="hidden" />
									</label>
								</div>
							</div>

							<div className="grid gap-2">
								{fields.map((field) => (
									<div className="grid gap-1" key={field.name}>
										<div className="flex items-center justify-between">
											<Label htmlFor={field.name}>{field.label}</Label>
										</div>
										<Input
											id={field.name}
											type={field.type}
											placeholder={field.placeholder}
											required
											name={field.name}
										/>
									</div>
								))}
								<Button type="submit" className="w-full">
									Save
								</Button>
							</div>
						</form>
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
