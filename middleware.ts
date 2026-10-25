import { NextResponse, type NextRequest } from "next/server";

// Quick gate: no cookie means go to login. Pages check the session properly.
export function middleware(req: NextRequest) {
  if (!req.cookies.has("acads_session")) return NextResponse.redirect(new URL("/login", req.url));
}

export const config = { matcher: ["/((?!login|logout|_next|favicon).*)"] };
