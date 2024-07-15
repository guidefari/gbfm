import React from "react";
import { StateProvider, useStateValue } from "./AuthContext";
import { SignIn } from "./SignIn";
import SignUp from "./SignUp";

export default function Auth() {
	const state = useStateValue();

	return state === "signIn" ? <SignIn /> : <SignUp />;
}
