import React, { createContext, useContext, useMemo, useState } from "react";
import type { GoosebumpsUser, LoginResponse } from "../types/auth";
import { writeToLocalStorage } from "@guide/utils";

const AuthContext = createContext<IContext | null>(null);

export function useAuthContext(): IContext {
	return useContext(AuthContext);
}

export const AuthProvider = ({ children }) => {
	const [user, setUser] = useState<GoosebumpsUser>();

	const onSignIn = (data: LoginResponse) => {
		if ("error" in data) {
			console.error(data.error);
			return;
		}
		setUser({
			avatarUrl: data.avatarUrl,
			email: data.email,
			id: data.id,
			username: data.username,
		});
		writeToLocalStorage({
			id: "login_token",
			tableName: "goosebumps",
			data: data.token,
		});
	};
	const onSignUp = (loggedInUser: GoosebumpsUser) => setUser(loggedInUser);
	const onSignOut = () => setUser(null);

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
