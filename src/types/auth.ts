export type AuthState = "signIn" | "signUp" | "resetPassword";

export type GoosebumpsUser = {
	id: string;
	email: string;
	username: string;
};

export type LoginResponse =
	| (GoosebumpsUser & { token: string })
	| { error: string };

export type PocketBaseSignUpResponse = {
	result: {
		avatar: string;
		collectionId: string;
		collectionName: string;
		created: string;
		emailVisibility: boolean;
		id: string;
		updated: string;
		username: string;
		verified: boolean;
	};
};

export type PocketBaseLoginResponse = {
	record: PocketBaseSignUpResponse["result"] & { email: string };
	token: string;
};
