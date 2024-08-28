import { db } from "@/db";
import { sessionTable, userTable } from "@/db/models/user/user.schema";
import { DrizzlePostgreSQLAdapter } from "@lucia-auth/adapter-drizzle";
import type { IncomingMessage, ServerResponse } from "node:http";
import { Lucia, type User } from "lucia";
import type { NextApiRequest, NextApiResponse } from "next";

export const adapter = new DrizzlePostgreSQLAdapter(
	db,
	sessionTable,
	userTable,
);

export const lucia = new Lucia(adapter, {
	sessionCookie: {
		attributes: {
			// set to `true` when using HTTPS
			secure: process.env.NODE_ENV === "production",
		},
	},
});

// IMPORTANT!
declare module "lucia" {
	interface Register {
		Lucia: typeof lucia;
	}
}

export async function validateLoginState(
	req: NextApiRequest | IncomingMessage,
	res: NextApiResponse | ServerResponse,
): Promise<User | null> {
	const cookies = "cookies" in req ? req.cookies : undefined;
	if (!cookies) return null;

	const sessionId = cookies[lucia.sessionCookieName];
	if (!sessionId) {
		return null;
	}
	const { session, user } = await lucia.validateSession(sessionId);
	if (!session) {
		res.setHeader("Set-Cookie", lucia.createBlankSessionCookie().serialize());
	}
	if (session?.fresh) {
		res.setHeader(
			"Set-Cookie",
			lucia.createSessionCookie(session.id).serialize(),
		);
	}
	return user;
}
