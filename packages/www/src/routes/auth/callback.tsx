import { useEffect } from "react";
// import { getAccount } from "@/app/actions";
// import Routes from "@/lib/routes";
// import { Session } from "@/lib/session";
import { createFileRoute } from "@tanstack/react-router";
import { Cookies } from "@/lib/cookies";
import { AUTH_BASE_URL } from "@/lib/http";

export const Route = createFileRoute("/auth/callback")({
	component: Component,
});

function Component() {
	useEffect(() => {
		async function handleAuthCallback() {
			const urlParams = new URLSearchParams(window.location.search);
			const code = urlParams.get("code");
			if (!code) {
				// navigate(Routes.home);
				return;
			}
			let token: string | undefined;

			try {
				const response = await fetch(`${AUTH_BASE_URL}/token`, {
					method: "POST",
					headers: { Accept: "application/json" },
					body: new URLSearchParams({
						grant_type: "authorization_code",
						client_id: "web",
						code,
						redirect_uri: window.location.origin + window.location.pathname,
					}),
				});

				const json = await response.json();
				console.log("json:", json);
				token = json.access_token;
				if (!token) {
					// navigate("/");
					return;
				}

				const expires = new Date();
				expires.setDate(expires.getDate() + 90);
				Cookies.set(Cookies.sessionKey, token, {
					path: "/",
					secure: true,
					expires,
					maxAge: 31536000,
					sameSite: "lax",
				});
			} catch (e) {
				console.error(e);
			}
		}

		handleAuthCallback();
	}, []);

	return <div>Processing authentication...</div>;
}

export default Component;
