"use client";
import type React from "react";
import { createContext, useContext, useEffect, useState } from "react";
import type { GoosebumpsUser, LoginResponse } from "../types/auth";
import { readFromLocalStorage, writeToLocalStorage } from "@guide/utils";

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

	const contextValues: IContext = {
		user,
		onSignIn,
		onSignUp,
		onSignOut,
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
};
