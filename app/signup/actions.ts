"use server";
import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { sql } from "@/lib/db";
import { MOBILE_RE, SIGNUP_USERNAME_RE, str } from "@/lib/util";

const FIELDS = ["name", "username", "school", "batch_id", "section", "roll_no", "parent_name", "parent_mobile"] as const;

export async function signUp(fd: FormData) {
  const v = Object.fromEntries(FIELDS.map((k) => [k, str(fd, k)])) as Record<(typeof FIELDS)[number], string>;
  v.username = v.username.toLowerCase();
  v.parent_mobile = v.parent_mobile.replace(/[\s-]/g, "").replace(/^(\+91|0)/, "");
  const password = str(fd, "password");
  // Send the form back filled in (never the password) with the problem on top.
  const back = (err: string): never => {
    const q = new URLSearchParams({ ...v, err });
    redirect(`/signup?${q}`);
  };
  if (FIELDS.some((k) => !v[k])) back("Please fill in every field.");
  if (!SIGNUP_USERNAME_RE.test(v.username)) back("Username must be 4–20 characters: letters, numbers or _.");
  if (password.length < 6) back("Password must be at least 6 characters.");
  if (password !== str(fd, "confirm")) back("The two passwords don't match.");
  if (!MOBILE_RE.test(v.parent_mobile)) back("Parent's mobile must be a 10-digit Indian mobile number.");
  if (!fd.has("consent")) back("A parent or guardian must agree before you can sign up.");
  const [batch] = await sql`select id from batches where id = ${Number(v.batch_id) || 0}`;
  if (!batch) back("Choose your class.");
  const err = await sql.begin(async (tx) => {
    const [u] = await tx`
      insert into users (username, password_hash, name, role, active, status)
      values (${v.username}, ${await bcrypt.hash(password, 10)}, ${v.name}, 'student', false, 'pending')
      on conflict (username) do nothing returning id`;
    if (!u) return `The username “${v.username}” is already taken. Try another.`;
    await tx`insert into students (user_id, batch_id, school, section, roll_no, parent_name, parent_mobile)
      values (${u.id}, ${batch.id}, ${v.school}, ${v.section}, ${v.roll_no}, ${v.parent_name}, ${v.parent_mobile})`;
    return null;
  });
  if (err) back(err);
  redirect(`/signup/status?new=1&u=${encodeURIComponent(v.username)}`);
}
