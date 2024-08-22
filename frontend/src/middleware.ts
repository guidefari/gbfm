import type { NextApiRequest, NextApiResponse } from "next"
import { type NextRequest, NextResponse } from "next/server"
// import db from "./data/pocketbase";

export const runtime = "experimental-edge"

export async function middleware(request: NextRequest, res: NextApiResponse) {
  console.log(`[middleware] ${request.method} ${request.url}`)
  const pb_cookie = request.cookies.get("pb_auth")?.value
  // const isLoggedIn = await db.isAuthenticated(pb_cookie);
  const isLoggedIn = false
  if (request.nextUrl.pathname?.startsWith("/auth")) {
    if (isLoggedIn) {
      return NextResponse.redirect(new URL("/", request.url))
    }
    return
  }

  if (!isLoggedIn) {
    console.log("[middleware] bro please just login abeg")
    // return NextResponse.redirect(new URL("/auth/login", request.url));
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
}
