import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { sql } from "./db";

export type Role = "admin" | "teacher" | "reception" | "student" | "parent";
export type Session = { uid: number; role: Role; name: string; v: number };

const COOKIE = "acads_session";
const key = () => new TextEncoder().encode(process.env.SESSION_SECRET);

// The reception desk is a shared device, so its sessions last 12 hours; everyone else stays signed in for 30 days.
export async function createSession(s: Session) {
  const seconds = s.role === "reception" ? 60 * 60 * 12 : 60 * 60 * 24 * 30;
  const token = await new SignJWT(s).setProtectedHeader({ alg: "HS256" }).setExpirationTime(`${seconds}s`).sign(key());
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: seconds,
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
// Someone given a temporary password must choose their own before anything else.
export async function requireRole(...roles: Role[]): Promise<Session> {
  const s = await currentUser();
  if (!s) redirect("/logout");
  if (s.mustChange) redirect("/password");
  if (roles.length && !roles.includes(s.role)) redirect("/app");
  return s;
}

// Like requireRole, but returns null instead of redirecting. For API routes and the change-password page.
export async function currentUser(): Promise<(Session & { mustChange: boolean }) | null> {
  const s = await readSession();
  if (!s) return null;
  const [u] = await sql`select active, status, session_version, role, name, must_change_password from users where id = ${s.uid}`;
  if (!u || !u.active || u.status !== "approved" || u.session_version !== s.v) return null;
  return { ...s, role: u.role as Role, name: u.name as string, mustChange: u.must_change_password as boolean };
}

export const TEACHING: Role[] = ["admin", "teacher"];
export const STAFF: Role[] = ["admin", "teacher", "reception"];
