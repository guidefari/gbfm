import { createSessionBuilder } from "sst/auth";

export const sessions = createSessionBuilder<{
	account: {
		id: string;
		email: string;
	};
}>();
