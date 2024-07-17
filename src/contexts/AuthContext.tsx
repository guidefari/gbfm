import React, { createContext, useContext, useState } from "react";
import type { User } from "../types/auth";

const AuthContext = createContext<IContext | null>(null);

export function useAuthContext(): IContext {
	return useContext(AuthContext);
}

export const AuthProvider = ({ children }) => {
	const [user, setUser] = useState<User>(null);

	const onSignIn = (loggedInUser: User) => setUser(loggedInUser);
	const onSignUp = (loggedInUser: User) => setUser(loggedInUser);
	const onSignOut = () => setUser(null);

	return (
		<AuthContext.Provider value={{ user, onSignIn, onSignUp, onSignOut }}>
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
