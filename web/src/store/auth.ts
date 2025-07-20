import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";

interface User {
	id: string;
	name: string;
	username: string;
	email: string;
	verified: boolean;
	createdAt: string;
	updatedAt: string;
	avatarUrl: string | null;
}

interface AuthState {
	user: User | null;
	accessToken: string | null;
	refreshToken: string | null;
	isAuthenticated: boolean;
	worker: Worker | null;
}

interface AuthActions {
	setAuth: (auth: {
		user: User;
		accessToken: string;
		refreshToken: string;
	}) => void;
	clearAuth: () => void;
	updateUser: (userData: Partial<User>) => void;
	getAccessToken: () => Promise<string | null>;
	initializeWorker: () => void;
	destroyWorker: () => void;
}

type AuthStore = AuthState & AuthActions;

export const useAuthStore = create<AuthStore>()(
	devtools(
		persist(
			(set, get) => ({
				user: null,
				accessToken: null,
				refreshToken: null,
				isAuthenticated: false,
				worker: null,
				setAuth: (auth) => {
					set(
						() => ({
							user: auth.user,
							accessToken: auth.accessToken,
							refreshToken: auth.refreshToken,
							isAuthenticated: true,
						}),
						false,
						"auth/set",
					);

					const { worker } = get();
					if (worker) {
						worker.postMessage({
							type: "SET_TOKENS",
							payload: {
								accessToken: auth.accessToken,
								refreshToken: auth.refreshToken,
							},
						});
					}
				},
				clearAuth: () => {
					set(
						() => ({
							user: null,
							accessToken: null,
							refreshToken: null,
							isAuthenticated: false,
						}),
						false,
						"auth/clear",
					);

					const { worker } = get();
					if (worker) {
						worker.postMessage({ type: "CLEAR_TOKENS" });
					}
				},
				updateUser: (userData) =>
					set(
						(state: AuthStore) => ({
							user: state.user ? { ...state.user, ...userData } : null,
						}),
						false,
						"auth/updateUser",
					),
				getAccessToken: async () => {
					const { worker } = get();
					if (!worker) {
						return get().accessToken;
					}

					return new Promise((resolve) => {
						const handleMessage = (event: MessageEvent) => {
							if (event.data.type === "ACCESS_TOKEN") {
								worker.removeEventListener("message", handleMessage);
								resolve(event.data.payload?.accessToken || null);
							}
						};

						worker.addEventListener("message", handleMessage);
						worker.postMessage({ type: "GET_ACCESS_TOKEN" });
					});
				},
				initializeWorker: () => {
					const { worker } = get();
					if (worker) return;

					const authWorker = new Worker(
						new URL("../worker.ts", import.meta.url),
						{
							type: "module",
						},
					);

					authWorker.addEventListener("message", (event) => {
						const { type, payload } = event.data;

						switch (type) {
							case "TOKENS_UPDATED":
								if (payload?.accessToken) {
									set(
										() => ({ accessToken: payload.accessToken }),
										false,
										"auth/tokenUpdated",
									);
								}
								break;
							case "REFRESH_FAILED":
								console.error("Token refresh failed:", payload?.error);
								break;
						}
					});

					console.info("initializing gbfm worker");
					set({ worker: authWorker }, false, "auth/workerInitialized");
				},
				destroyWorker: () => {
					const { worker } = get();
					if (worker) {
						console.info("destroying gbfm worker");
						worker.terminate();
						set({ worker: null }, false, "auth/workerDestroyed");
					}
				},
			}),
			{
				name: "auth-store",
				partialize: (state) => ({
					user: state.user,
					accessToken: state.accessToken,
					refreshToken: state.refreshToken,
					isAuthenticated: state.isAuthenticated,
				}),
			},
		),
		{
			name: "auth-store",
		},
	),
);
