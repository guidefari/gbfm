import db from "@/src/data/pocketbase";
import type {
  PocketBaseSignUpResponse,
  GoosebumpsUser,
} from "@/src/types/auth";
import type { NextApiRequest, NextApiResponse } from "next";

// export const runtime = "edge";

export default async function handler(
  request: NextApiRequest,
  res: NextApiResponse<GoosebumpsUser | { error: string } | unknown>,
) {
  try {
    const body = await JSON.parse(request.body);
    console.log('body:', body)
    if (!body.email || !body.password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const thingy = {


    }

    // as RPM would say, "DISGUSTING", lol. need runtime validation of these inputs
    const result: PocketBaseSignUpResponse = await db.updateProfile({ username: body.username, id: body.id, email: body.email, avatarUrl: body.avatarUrl });
    // const sanitisedUser: GoosebumpsUser = {
    // 	id: result.result.id,
    // 	email: body.email,
    // 	username: result.result.username,
    // 	avatarUrl: result.result.avatar,
    // };

    return res.status(200).json(result);
  } catch (err) {
    return res.status(500).json({ error: err.message || err.toString() });
  }
}
