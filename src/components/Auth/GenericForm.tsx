import type React from "react";
import type { HTMLInputTypeAttribute } from "react";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { LockIcon } from "@/components/common/icons";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

type Props = {
	fields: FormField[];
	onSubmit: (event: React.FormEvent<HTMLFormElement>) => Promise<void>;
	formTitle: string;
};

export type FormField = {
	label: string;
	name: string;
	type: HTMLInputTypeAttribute;
	placeholder: string;
};

export const GenericAuthForm = ({ fields, onSubmit, formTitle }: Props) => {
	return (
		<div className="flex min-h-[65dvh] flex-col items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
			<div className="w-full max-w-md mx-auto space-y-8">
				<div className="flex flex-col items-center justify-center space-y-2">
					<div className="inline-flex items-center px-3 py-1 text-sm font-medium rounded-full bg-primary text-primary-foreground">
						<LockIcon className="w-4 h-4 mr-2" />
						{formTitle}
					</div>
				</div>
				<Card>
					<CardContent className="space-y-4">
						<form onSubmit={onSubmit}>
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
									{formTitle}
								</Button>
							</div>
						</form>
					</CardContent>
				</Card>
			</div>
		</div>
	);
};
