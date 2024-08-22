import { generateId } from "lucia";
import { hash } from "@node-rs/argon2";

import type { NextApiRequest, NextApiResponse } from "next";
import { lucia } from "@/src/db/auth";
import { insertUser } from "@/src/db/schema";
import { z } from "zod";
import { captureException } from "@sentry/nextjs";

export default async function handler(
	req: NextApiRequest,
	res: NextApiResponse,
) {
	if (req.method !== "POST") {
		res.status(404).end();
		return;
	}

	const body: null | Partial<{ email: string; password: string }> = req.body;
	const email = body?.email;
	const emailSchema = z.string().email();

	if (!email || !emailSchema.parse(email)) {
		res.status(400).json({
			error: "Invalid email",
		});
		return;
	}
	const password = body?.password;
	if (!password || password.length < 6 || password.length > 255) {
		res.status(400).json({
			error: "Invalid password",
		});
		return;
	}

	const passwordHash = await hash(password, {
		// recommended minimum parameters
		memoryCost: 19456,
		timeCost: 2,
		outputLen: 32,
		parallelism: 1,
	});
	const userId = generateId(15);

	try {
		// db.prepare(
		// 	"INSERT INTO user (id, username, password_hash) VALUES(?, ?, ?)",
		// ).run(userId, username, passwordHash);
		const insertResult = await insertUser({
			email,
			id: userId,
			password: passwordHash,
		});

		console.log({ insertResult });

		const session = await lucia.createSession(userId, {});
		res
			.appendHeader(
				"Set-Cookie",
				lucia.createSessionCookie(session.id).serialize(),
			)
			.status(200)
			.end();
		return;
	} catch (e) {
		// check for specific e.code when item already exists
		if (typeof e === "object" && e?.code === "23505") {
			res.status(400).json({
				error: "email already exists",
			});
			return;
		}
		captureException(e);

		res.status(500).json({
			error: "An unknown error occurred",
			stack: e,
		});
		return;
	}
}
