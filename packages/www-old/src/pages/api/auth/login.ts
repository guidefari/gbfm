import type { NextApiRequest, NextApiResponse } from "next";

// export const runtime = "edge";

export default async function handler(
	request: NextApiRequest,
	res: NextApiResponse,
) {
	return res.status(200).json({ success: true });

	// try {
	//     const { body } = await request;
	//     // const result = await db.authenticate(body.email, body.password);
	//     const { record, token } = result as PocketBaseLoginResponse;
	//     if (!record || !token) {
	//         return res.status(401).json({ error: "Invalid credentials" });
	//     }

	//     return res.status(200).json({ avatarUrl: record.avatar, id: record.id, email: record.email, username: record.username, token });
	// } catch (err) {
	//     return res.status(500).json({ error: err.message || err.toString() });
	// }
}
