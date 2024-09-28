import {
	InputOTP,
	InputOTPGroup,
	InputOTPSlot,
} from "@/components/ui/input-otp";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/auth/verify")({
	component: VerifyPage,
});

function VerifyPage() {
	return (
		<InputOTP maxLength={6} disabled={false}>
			<InputOTPGroup>
				<InputOTPSlot index={0} />
				<InputOTPSlot index={1} />
				<InputOTPSlot index={2} />
				<InputOTPSlot index={3} />
				<InputOTPSlot index={4} />
				<InputOTPSlot index={5} />
			</InputOTPGroup>
		</InputOTP>
	);
}
