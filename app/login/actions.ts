"use server";
import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { sql } from "@/lib/db";
import { createSession, Role } from "@/lib/auth";
import { str } from "@/lib/util";

export async function login(fd: FormData) {
  const username = str(fd, "username").toLowerCase();
  const [u] = await sql`select id, name, role, password_hash, active, session_version from users where username = ${username}`;
  const ok = u && u.active && (await bcrypt.compare(str(fd, "password"), u.password_hash));
  if (!ok) redirect("/login?err=" + encodeURIComponent("Wrong username or password."));
  await createSession({ uid: u.id, role: u.role as Role, name: u.name, v: u.session_version });
  redirect("/app");
}
