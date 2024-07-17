import React, { createContext, useContext, useMemo, useState } from "react";
import type { User } from "../types/auth";

const AuthContext = createContext<IContext | null>(null);

export function useAuthContext(): IContext {
	return useContext(AuthContext);
}

export const AuthProvider = ({ children }) => {
	const [user, setUser] = useState<User>();

	const onSignIn = (loggedInUser: User) => setUser(loggedInUser);
	const onSignUp = (loggedInUser: User) => setUser(loggedInUser);
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
	user: User;
	onSignUp: (user: User) => void;
	onSignIn: (user: User) => void;
	onSignOut: () => void;
};
