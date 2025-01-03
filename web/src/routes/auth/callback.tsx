import { useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AuthCallback } from "@/lib/http";
export const Route = createFileRoute("/auth/callback")({
	component: Component,
});

function Component() {
	useEffect(() => {
		async function handleAuthCallback() {
			const hash = new URLSearchParams(location.search.slice(1));
			const code = hash.get("code");
			const state = hash.get("state");

			if (code && state) {
				AuthCallback(code, state);
			}
		}
		handleAuthCallback();
	}, []);

	return <div>Processing authentication...</div>;
}

export default Component;
