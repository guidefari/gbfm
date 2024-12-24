import { useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useAuthContext } from "@/contexts/AuthContext";
export const Route = createFileRoute("/auth/callback")({
	component: Component,
});

function Component() {
	const { callback } = useAuthContext();
	// biome-ignore lint/correctness/useExhaustiveDependencies: calm
	useEffect(() => {
		async function handleAuthCallback() {
			const hash = new URLSearchParams(location.search.slice(1));
			const code = hash.get("code");
			const state = hash.get("state");

			if (code && state) {
				callback(code, state);
			}
		}
		handleAuthCallback();
	}, []);

	return <div>Processing authentication...</div>;
}

export default Component;
