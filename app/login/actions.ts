"use server";
import bcrypt from "bcryptjs";
import { SignJWT } from "jose";
import { redirect } from "next/navigation";
import { sql } from "@/lib/db";
import { createSession, currentUser, Role } from "@/lib/auth";
import { str, withMsg } from "@/lib/util";

const LOCK_AFTER = 5, LOCK_MINUTES = 15;
const fail = (text: string) => redirect(withMsg("/login", "err", text));

export async function login(fd: FormData) {
  // Without a secret no session can be signed; say so instead of failing silently (e.g. a preview missing its env vars).
  if (!process.env.SESSION_SECRET) fail("Sign-in isn't set up on this site yet: SESSION_SECRET is missing in Vercel's environment variables.");
  const username = str(fd, "username").toLowerCase();
  const [u] = await sql`select id, name, role, password_hash, active, status, session_version, failed_logins,
    locked_until > now() as locked from users where username = ${username}`;
  if (u?.locked) fail(`Too many wrong passwords. Try again in ${LOCK_MINUTES} minutes, or ask the office to reset it.`);
  const ok = u && (await bcrypt.compare(str(fd, "password"), u.password_hash));
  if (!ok) {
    if (u) await sql`update users set failed_logins = case when failed_logins + 1 >= ${LOCK_AFTER} then 0 else failed_logins + 1 end,
      locked_until = case when failed_logins + 1 >= ${LOCK_AFTER} then now() + ${LOCK_MINUTES + " minutes"}::interval else locked_until end
      where id = ${u.id}`;
    fail("Wrong username or password.");
  }
  await sql`update users set failed_logins = 0, locked_until = null where id = ${u.id}`;
  // A sign-up waiting for approval (or turned down) sees its status instead of any data.
  if (u.status !== "approved") {
    const token = await new SignJWT({ uid: u.id }).setProtectedHeader({ alg: "HS256" }).setExpirationTime("1h")
      .sign(new TextEncoder().encode(process.env.SESSION_SECRET));
    redirect(`/signup/status?t=${token}`);
  }
  if (!u.active) fail("This login has been turned off. Please speak to the office.");
  await createSession({ uid: u.id, role: u.role as Role, name: u.name, v: u.session_version });
  redirect("/app");
}

export async function requestReset(fd: FormData) {
  const username = str(fd, "username").toLowerCase();
  const back = "/login/forgot";
  if (!username) redirect(withMsg(back, "err", "Type your username."));
  const [u] = await sql`select id from users where username = ${username} and role <> 'admin'`;
  // Same answer whether or not the username exists, so nobody can test which usernames are real.
  if (u) {
    const [open] = await sql`select id from reset_requests where user_id = ${u.id} and handled_at is null`;
    if (!open) await sql`insert into reset_requests (user_id, note) values (${u.id}, ${str(fd, "note").slice(0, 200)})`;
  }
  redirect(withMsg("/login", "ok", "Request sent. The office will give you a temporary password; you'll choose a new one when you sign in."));
}

export async function changePassword(fd: FormData) {
  const s = await currentUser();
  if (!s) redirect("/logout");
  const back = "/password";
  const next = str(fd, "password");
  if (next.length < 6) redirect(withMsg(back, "err", "Choose a password of at least 6 characters."));
  if (next !== str(fd, "confirm")) redirect(withMsg(back, "err", "The two passwords don't match."));
  const [u] = await sql`select password_hash from users where id = ${s.uid}`;
  if (!s.mustChange && !(await bcrypt.compare(str(fd, "current"), u.password_hash)))
    redirect(withMsg(back, "err", "Your current password is wrong."));
  const [row] = await sql`update users set password_hash = ${await bcrypt.hash(next, 10)}, must_change_password = false,
    session_version = session_version + 1 where id = ${s.uid} returning session_version`;
  // Changing the password signs out other devices; keep this one signed in.
  await createSession({ uid: s.uid, role: s.role, name: s.name, v: row.session_version });
  redirect(withMsg("/app", "ok", "Password changed."));
}
