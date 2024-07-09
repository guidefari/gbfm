import db from '@/src/data/pocketbase';
import type { NextApiResponse } from 'next';
import { cookies } from 'next/headers';
import { NextResponse } from "next/server";

export const runtime = 'edge'

export default async function POST(request: Request, res: NextApiResponse) {
  try {
    const { email, password } = await request.json();

    const result = await db.register(email, password);
    console.log({ result })

    return NextResponse.json(db.client.health);
    // return NextResponse.json({result});
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message || err.toString() }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    )
  }
}
