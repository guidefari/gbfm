import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/settings/profile")({
	component: Profile,
});

function Profile() {
	return <div>Hello /settings/profile!</div>;
}
