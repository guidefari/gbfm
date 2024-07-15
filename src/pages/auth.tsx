import Auth from "@/components/auth";
import { StateProvider } from "@/components/auth/AuthContext";
import React from "react";

const AuthPage = () => {
	return (
		<StateProvider>
			<Auth />
		</StateProvider>
	);
};

export default AuthPage;
