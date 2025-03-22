"use client";
import type React from "react";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { toast } from "@/components/ui/use-toast";
import { API_BASE_URL, AUTH_BASE_URL } from "@/lib/http";
import { createClient } from "@openauthjs/openauth/client";

export const AuthClient_Frontend = createClient({
	clientID: "gbfm-www",
	issuer: AUTH_BASE_URL,
});

type IContext = {
	user: string | null;
	userData: Record<string, string> | null;
	getToken: () => Promise<string | undefined>;
	login: () => Promise<void>;
	logout: () => void;
	loggedIn: boolean;
	loaded: boolean;
	// useUser: (id: string) => {
	// 	user: GoosebumpsUser | null;
	// 	isLoading: boolean;
	// 	isError: boolean;
	// };
};

const AuthContext = createContext<IContext | null>(null);

export function useAuthContext(): IContext {
	const context = useContext(AuthContext);
	if (context === null) {
		throw new Error("useAuthContext must be used within an AuthProvider");
	}
	return context;
}


export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
	const [userId, setUserId] = useState<string | null>(null);
	const [loaded, setLoaded] = useState(false);
	const [loggedIn, setLoggedIn] = useState(false);
	const [userData, setUserData] = useState<Record<string, string> | null>(null);
	const initializing = useRef(true);
	const token = useRef<string | undefined>(undefined);

	
	useEffect(() => {
		const hash = new URLSearchParams(location.search.slice(1));
		const code = hash.get("code");
		const state = hash.get("state");

		if (!initializing.current) {
			return;
		}

		initializing.current = false;

		if (code && state) {
			AuthCallback(code, state);
			return;
		}

		auth();
		
	}, []);

	async function auth() {
		const token = await refreshTokens();

		if (token) {
			await getUser();
		}

		setLoaded(true);
	}

	async function refreshTokens() {
		const refresh = localStorage.getItem("refresh");
		if (!refresh) return;
		const next = await AuthClient_Frontend.refresh(refresh, {
			access: token.current,
		});
		if (next.err) return;
		if (!next.tokens) return token.current;

		localStorage.setItem("refresh", next.tokens.refresh);
		token.current = next.tokens.access;

		return next.tokens.access;
	}

	async function getToken() {
		const token = await refreshTokens();

		if (!token) {
			await login();
			return;
		}

		return token;
	}
	
	async function AuthCallback(code: string, state: string) {
		const challenge = JSON.parse(sessionStorage.getItem("challenge") ?? "");
		if (!challenge) {
			toast({
				title: "No challenge found",
				description: "Please try again",
			});
			return;
		}
	
		if (code) {
			if (state === challenge.state && challenge.verifier) {
				const exchanged = await AuthClient_Frontend.exchange(
					code,
					location.origin,
					challenge.verifier,
				);
				if (!exchanged.err) {
					token.current = exchanged.tokens?.access;
					localStorage.setItem("refresh", exchanged.tokens.refresh);
				}
			}
			window.location.replace("/");
		}
	}
	
	 async function login() {
		// if (!token.current) {
			const { challenge, url } = await AuthClient_Frontend.authorize(
				location.origin,
				"code",
				{
					pkce: true,
				},
			);
			sessionStorage.setItem("challenge", JSON.stringify(challenge));
			location.href = url;
		// }
	}
	
	async function getUser() {
		const res = await fetch(`${API_BASE_URL}/users`, {
			headers: {
				Authorization: `Bearer ${token.current}`,
			},
		});

		if (res.ok) {
			const user: Record<string, string> = await res.json();

			setUserId(user.id);
			setLoggedIn(true);
			setUserData(user);
			return user
		}

	}

	function logout() {
		localStorage.removeItem("refresh");
		token.current = undefined;

		window.location.replace("/");
	}
	

	const contextValues: IContext = {
		user: userId,
		getToken,
		login,
		logout,
		loggedIn,
		loaded,
		userData,
	};

	return (
		<AuthContext.Provider value={contextValues}>
			{children}
		</AuthContext.Provider>
	);
};


