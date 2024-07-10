import db from "@/src/data/pocketbase";
import type { NextApiResponse } from "next";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export const runtime = "edge";

export default async function POST(request: Request, res: NextApiResponse) {
	try {
		const { email, password } = await request.json();

		const result = await db.register(email, password);

		return NextResponse.json(result);
	} catch (err) {
		return new Response(
			// check for type of error beforehand?
			JSON.stringify(err),
			{
				status: 500,
				headers: {
					"Content-Type": "application/json",
				},
			},
		);
	}
}
