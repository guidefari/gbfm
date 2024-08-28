"use client"
import React, {
	createContext,
	useContext,
	useEffect,
	useMemo,
	useState,
} from "react";
import type { GoosebumpsUser, LoginResponse } from "../types/auth";
import { readFromLocalStorage, writeToLocalStorage } from "@guide/utils";

const AuthContext = createContext<IContext | null>(null);

export function useAuthContext(): IContext {
	return useContext(AuthContext);
}

export const AuthProvider = ({ children }) => {
	const [user, setUser] = useState<GoosebumpsUser>();

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

	// biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
	const contextValues = useMemo(
		() => ({
			user,
			onSignIn,
			onSignUp,
			onSignOut,
		}),
		[user],
	);

	return (
		<AuthContext.Provider value={contextValues}>
			{children}
		</AuthContext.Provider>
	);
};

type IContext = {
	user: GoosebumpsUser;
	onSignUp: (user: GoosebumpsUser) => void;
	onSignIn: (data: LoginResponse) => void;
	onSignOut: () => void;
};
