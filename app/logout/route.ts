import { NextResponse } from "next/server";
import { clearSession } from "@/lib/auth";

async function out(req: Request) {
  await clearSession();
  return NextResponse.redirect(new URL("/login", req.url), 303);
}
export { out as GET, out as POST };
