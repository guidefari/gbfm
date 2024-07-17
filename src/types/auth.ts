export type AuthState = "signIn" | "signUp" | "resetPassword";

export type User = {
	id: string;
	email: string;
	username: string;
	avatarUrl: string;
};

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
