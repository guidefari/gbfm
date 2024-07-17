import React, { createContext, useContext, useMemo, useState } from "react";
import type { GoosebumpsUser } from "../types/auth";

const AuthContext = createContext<IContext | null>(null);

export function useAuthContext(): IContext {
	return useContext(AuthContext);
}

export const AuthProvider = ({ children }) => {
	const [user, setUser] = useState<GoosebumpsUser>();

	const onSignIn = (loggedInUser: GoosebumpsUser) => setUser(loggedInUser);
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
	onSignIn: (user: GoosebumpsUser) => void;
	onSignOut: () => void;
};
