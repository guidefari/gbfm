import db from "@/src/data/pocketbase";
import type {
	PocketBaseSignUpResponse,
	GoosebumpsUser,
} from "@/src/types/auth";
import type { NextApiRequest, NextApiResponse } from "next";

// export const runtime = "edge";

export default async function handler(
	request: NextApiRequest,
	res: NextApiResponse<GoosebumpsUser | { error: string }>,
) {
	try {
		const { body } = await request;
		if (!body.email || !body.password) {
			return res.status(400).json({ error: "Email and password are required" });
		}

		const result: PocketBaseSignUpResponse = await db.register(body.email, body.password);
		const sanitisedUser: GoosebumpsUser = {
			id: result.result.id,
			email: body.email,
			username: result.result.username,
			avatarUrl: result.result.avatar,
		};

		return res.status(200).json(sanitisedUser);
	} catch (err) {
		return res.status(500).json({ error: err.message || err.toString() });
	}
}
