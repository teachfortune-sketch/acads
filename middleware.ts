import { NextResponse, type NextRequest } from "next/server";

// Quick gate: no cookie means go to login. Pages check the session properly.
export function middleware(req: NextRequest) {
  if (!req.cookies.has("acads_session")) return NextResponse.redirect(new URL("/login", req.url));
}

// The home page (/), login, sign-up and the logo images are public.
export const config = { matcher: ["/((?!login|logout|signup|_next|favicon|icon|apple-icon|acads-).+)"] };
