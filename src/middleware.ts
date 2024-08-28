import { verifyRequestOrigin } from "lucia";
import type { NextApiRequest, NextApiResponse } from "next";
import { type NextRequest, NextResponse } from "next/server";
import { lucia } from "./services/auth";
// import db from "./data/pocketbase";

export const runtime = "experimental-edge";

const protectedUrls = ["/settings", "/auth"];

export async function middleware(request: NextRequest, res: NextApiResponse) {
	CSRFCheck(request);
	// const valid = await validateRequest(request)

	// const session_cookie = request.cookies.get("auth_session")?.value;
	// const isLoggedIn = !!session_cookie;

	// if (request.nextUrl.pathname?.startsWith("/auth")) {
	// 	if (isLoggedIn) {
	// 		return NextResponse.redirect(new URL("/", request.url));
	// 	}
	// 	return;
	// }

	return NextResponse.next();
}

export const config = {
	matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

function CSRFCheck(request: NextRequest) {
	if (request.method === "GET") {
		return;
	}

	const originHeader = request.headers.get("origin");
	// NOTE: You may need to use `X-Forwarded-Host` instead
	const hostHeader = request.headers.get("Host");
	if (
		!originHeader ||
		!hostHeader ||
		!verifyRequestOrigin(originHeader, [hostHeader])
	) {
		return new NextResponse(null, {
			status: 403,
		});
	}
}
