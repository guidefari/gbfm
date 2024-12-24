"use client";
import type React from "react";
import { useRef } from "react";
import { createContext, useContext, useEffect, useState } from "react";
import type { GoosebumpsUser, LoginResponse } from "../types/auth";
import { readFromLocalStorage, writeToLocalStorage } from "@guide/utils";
import { createClient } from "@openauthjs/openauth/client";
import { AUTH_BASE_URL } from "@/lib/http";

const client = createClient({
	clientID: "gbfm-www",
	// issuer: location.origin,
	issuer: AUTH_BASE_URL,
});

const AuthContext = createContext<IContext | null>(null);

export function useAuthContext(): IContext {
	const context = useContext(AuthContext);
	if (context === null) {
		throw new Error("useAuthContext must be used within an AuthProvider");
	}
	return context;
}

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
	const [user, setUser] = useState<GoosebumpsUser | null>(null);
	const accessToken = useRef<string | undefined>(undefined);

	useEffect(() => {
		const user = readFromLocalStorage<GoosebumpsUser>({
			id: "user",
			tableName: "goosebumps",
		});
		if (user) {
			setUser(user);
		}
	}, []);

	const onSignIn = (data: LoginResponse) => {
		if ("error" in data) {
			console.error(data.error);
			return;
		}
		setUser({
			email: data.email,
			id: data.id,
			username: data.username,
		});
		writeToLocalStorage({
			id: "login_token",
			tableName: "goosebumps",
			data: data.token,
		});
		writeToLocalStorage({
			id: "user",
			tableName: "goosebumps",
			data: data,
		});
	};
	const onSignUp = (loggedInUser: GoosebumpsUser) => setUser(loggedInUser);
	const onSignOut = () => {
		setUser(null);
		writeToLocalStorage({
			id: "login_token",
			tableName: "goosebumps",
			data: null,
		});
		writeToLocalStorage({
			id: "user",
			tableName: "goosebumps",
			data: null,
		});
	};

	async function getToken() {
		const refresh = localStorage.getItem("refresh");
		if (!refresh) return;
		const next = await client.refresh(refresh, {
			access: accessToken.current,
		});
		if (next.err) return;
		if (!next.tokens) return accessToken.current;

		localStorage.setItem("refresh", next.tokens.refresh);
		accessToken.current = next.tokens.access;

		return next.tokens.access;
	}

	async function login() {
		const token = await getToken();
		if (!token) {
			const { challenge, url } = await client.authorize(
				`${location.origin}/auth/callback`,
				"code",
				{
					pkce: true,
				},
			);
			sessionStorage.setItem("challenge", JSON.stringify(challenge));
			location.href = url;
		}
	}

	async function callback(code: string, state: string) {
		const challenge = JSON.parse(sessionStorage.getItem("challenge") ?? "");
		if (code) {
			if (state === challenge.state && challenge.verifier) {
				const exchanged = await client.exchange(
					code,
					`${location.origin}/auth/callback`,
					challenge.verifier,
				);
				console.log("exchanged:", exchanged);
				if (!exchanged.err) {
					accessToken.current = exchanged.tokens?.access;
					localStorage.setItem("refresh", exchanged.tokens.refresh);
				}
			}
			window.location.replace("/");
		}
	}

	const contextValues: IContext = {
		user,
		onSignIn,
		onSignUp,
		onSignOut,
		login,
		getToken,
		callback,
	};

	return (
		<AuthContext.Provider value={contextValues}>
			{children}
		</AuthContext.Provider>
	);
};

type IContext = {
	user: GoosebumpsUser | null;
	onSignUp: (user: GoosebumpsUser) => void;
	onSignIn: (data: LoginResponse) => void;
	onSignOut: () => void;
	login: () => Promise<void>;
	getToken: () => Promise<string | undefined>;
	callback: (code: string, state: string) => Promise<void>;
};
