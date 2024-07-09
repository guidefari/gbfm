import type { NextApiResponse } from "next";
import { type NextRequest, NextResponse } from "next/server";
import db from "./data/pocketbase";

export const runtime = 'experimental-edge'

export async function middleware(request: NextRequest, res: NextApiResponse) {
    console.log(`[middleware] ${request.method} ${request.url}`);
    const isLoggedIn = await db.isAuthenticated(request.cookies);
    if (request.nextUrl.pathname?.startsWith("/auth")) {
        if (isLoggedIn) {
            return NextResponse.redirect(new URL("/", request.url));
        }
        return;
    }

    if (!isLoggedIn) {
        return NextResponse.redirect(new URL("/auth/login", request.url));
    }

    return NextResponse.next();
}

export const config = {
    matcher: [
        '/((?!api|_next/static|_next/image|favicon.ico).*)',
    ],
};