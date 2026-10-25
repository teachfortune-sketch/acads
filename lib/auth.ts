import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { sql } from "./db";

export type Role = "admin" | "teacher" | "student" | "parent";
export type Session = { uid: number; role: Role; name: string; v: number };

const COOKIE = "acads_session";
const key = () => new TextEncoder().encode(process.env.SESSION_SECRET);

export async function createSession(s: Session) {
  const token = await new SignJWT(s).setProtectedHeader({ alg: "HS256" }).setExpirationTime("30d").sign(key());
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function clearSession() {
  (await cookies()).delete(COOKIE);
}

// Cookie only, no database check. For pages that work signed in or out.
export async function readSession(): Promise<Session | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key());
    return payload as unknown as Session;
  } catch {
    return null;
  }
}

// Checks the cookie and that the account is still active with the same password.
// Resetting a password bumps session_version, which signs that person out everywhere.
export async function requireRole(...roles: Role[]): Promise<Session> {
  const s = await readSession();
  if (!s) redirect("/login");
  const [u] = await sql`select active, session_version, role, name from users where id = ${s.uid}`;
  if (!u || !u.active || u.session_version !== s.v) redirect("/logout");
  const session = { ...s, role: u.role as Role, name: u.name as string };
  if (roles.length && !roles.includes(session.role)) redirect("/app");
  return session;
}

export const TEACHING: Role[] = ["admin", "teacher"];
