import { jwtDecode } from "jwt-decode";

interface JWTPayload {
	sub: string;
	email: string;
	type: "access" | "refresh";
	exp: number;
	iat: number;
}

interface AuthMessage {
	type: "SET_TOKENS" | "GET_ACCESS_TOKEN" | "CLEAR_TOKENS" | "REFRESH_TOKEN";
	payload?: {
		accessToken?: string;
		refreshToken?: string;
	};
}

interface AuthResponse {
	type: "ACCESS_TOKEN" | "TOKENS_UPDATED" | "TOKENS_CLEARED" | "REFRESH_FAILED";
	payload?: {
		accessToken?: string | null;
		refreshToken?: string;
		error?: string;
	};
}

let accessToken: string | null = null;
let refreshToken: string | null = null;
let refreshTimeout: ReturnType<typeof setTimeout> | null = null;
let isRefreshing = false;

const VPS_BASE_URL = import.meta.env.VITE_VPS_BASE_URL;

function scheduleTokenRefresh(token: string) {
	try {
		const decoded = jwtDecode<JWTPayload>(token);
		const now = Math.floor(Date.now() / 1000);
		const timeUntilExpiry = decoded.exp - now;

		const refreshTime = Math.max((timeUntilExpiry - 300) * 1000, 1000);

		if (refreshTimeout) {
			clearTimeout(refreshTimeout);
		}

		refreshTimeout = setTimeout(async () => {
			await refreshAccessToken();
		}, refreshTime);

		console.log(`Token refresh scheduled in ${refreshTime / 1000} seconds`);
	} catch (error) {
		console.error("Failed to decode token for scheduling refresh:", error);
	}
}

async function refreshAccessToken(): Promise<string | null> {
	if (isRefreshing || !refreshToken) {
		return accessToken;
	}

	isRefreshing = true;

	try {
		const response = await fetch(`${VPS_BASE_URL}/auth/refresh-token`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ refreshToken }),
		});

		if (response.ok) {
			const data = await response.json();
			accessToken = data.accessToken;

			if (accessToken) {
				scheduleTokenRefresh(accessToken);
			}

			self.postMessage({
				type: "TOKENS_UPDATED",
				payload: { accessToken },
			} as AuthResponse);

			return accessToken;
		}

		console.error("Failed to refresh token:", response.status);

		self.postMessage({
			type: "REFRESH_FAILED",
			payload: { error: "Token refresh failed" },
		} as AuthResponse);

		return null;
	} catch (error) {
		console.error("Error refreshing token:", error);

		self.postMessage({
			type: "REFRESH_FAILED",
			payload: { error: "Network error during token refresh" },
		} as AuthResponse);

		return null;
	} finally {
		isRefreshing = false;
	}
}

function clearTokens() {
	accessToken = null;
	refreshToken = null;

	if (refreshTimeout) {
		clearTimeout(refreshTimeout);
		refreshTimeout = null;
	}

	isRefreshing = false;
}

self.addEventListener("message", async (event: MessageEvent<AuthMessage>) => {
	const { type, payload } = event.data;

	switch (type) {
		case "SET_TOKENS":
			if (payload?.accessToken && payload?.refreshToken) {
				accessToken = payload.accessToken;
				refreshToken = payload.refreshToken;

				scheduleTokenRefresh(payload.accessToken);

				self.postMessage({
					type: "TOKENS_UPDATED",
					payload: { accessToken, refreshToken },
				} as AuthResponse);
			}
			break;

		case "GET_ACCESS_TOKEN":
			if (!accessToken) {
				self.postMessage({
					type: "ACCESS_TOKEN",
					payload: { accessToken: null },
				} as AuthResponse);
				return;
			}

			try {
				const decoded = jwtDecode<JWTPayload>(accessToken);
				const now = Math.floor(Date.now() / 1000);

				if (decoded.exp <= now + 300) {
					const newToken = await refreshAccessToken();
					self.postMessage({
						type: "ACCESS_TOKEN",
						payload: { accessToken: newToken },
					} as AuthResponse);
				} else {
					self.postMessage({
						type: "ACCESS_TOKEN",
						payload: { accessToken },
					} as AuthResponse);
				}
			} catch (error) {
				console.error("Error decoding token:", error);
				self.postMessage({
					type: "ACCESS_TOKEN",
					payload: { accessToken: null },
				} as AuthResponse);
			}
			break;

		case "REFRESH_TOKEN": {
			const newToken = await refreshAccessToken();
			self.postMessage({
				type: "ACCESS_TOKEN",
				payload: { accessToken: newToken },
			} as AuthResponse);
			break;
		}

		case "CLEAR_TOKENS":
			clearTokens();
			self.postMessage({
				type: "TOKENS_CLEARED",
			} as AuthResponse);
			break;
	}
});
