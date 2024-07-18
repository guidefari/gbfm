import db from "@/src/data/pocketbase";
import type { LoginResponse, PocketBaseLoginResponse } from "@/src/types/auth";
import type { NextApiRequest, NextApiResponse } from "next";

// export const runtime = "edge";

export default async function handler(
    request: NextApiRequest,
    res: NextApiResponse<LoginResponse>,
) {
    try {
        const { body } = await request;
        const result = await db.authenticate(body.email, body.password);
        console.log("result:", result);
        const { record, token } = result as PocketBaseLoginResponse;
        if (!record || !token) {
            return res.status(401).json({ error: "Invalid credentials" });
        }

        return res.status(200).json({ avatarUrl: record.avatar, id: record.id, email: record.email, username: record.username, token });
    } catch (err) {
        return res.status(500).json({ error: err.message || err.toString() });
    }
}
