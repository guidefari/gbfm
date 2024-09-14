export type AuthState = "signIn" | "signUp" | "resetPassword";

export type GoosebumpsUser = {
	id: string;
	email: string;
	username: string;
};

export type LoginResponse =
	| (GoosebumpsUser & { token: string })
	| { error: string };
