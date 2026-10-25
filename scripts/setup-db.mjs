// Creates the tables, the Class 6–10 batches, the five subjects and the first admin login.
// Usage: DATABASE_URL=... ADMIN_USERNAME=rahul ADMIN_PASSWORD=... node scripts/setup-db.mjs
import { readFileSync } from "node:fs";
import postgres from "postgres";
import bcrypt from "bcryptjs";

const sql = postgres(process.env.DATABASE_URL, { prepare: false, max: 1, onnotice: () => {} });
await sql.unsafe(readFileSync(new URL("../db/schema.sql", import.meta.url), "utf8"));

const batches = ["Class 6", "Class 7", "Class 8", "Class 9", "Class 10"];
for (const [i, name] of batches.entries())
  await sql`insert into batches (name, sort) values (${name}, ${i}) on conflict (name) do nothing`;
const subjects = ["Maths", "Science", "Social", "Hindi", "English"];
for (const [i, name] of subjects.entries())
  await sql`insert into subjects (name, sort) values (${name}, ${i}) on conflict (name) do nothing`;

const [{ count }] = await sql`select count(*)::int as count from users where role = 'admin'`;
if (count === 0) {
  const username = (process.env.ADMIN_USERNAME || "admin").toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!password || password.length < 6) {
    console.error("Set ADMIN_PASSWORD (6+ characters) to create the first admin login.");
    process.exit(1);
  }
  const [admin] = await sql`
    insert into users (username, password_hash, name, role)
    values (${username}, ${await bcrypt.hash(password, 10)}, ${process.env.ADMIN_NAME || "Rahul"}, 'admin')
    returning id`;
  // Rahul teaches Maths, Science and Social.
  await sql`
    insert into teacher_subjects (teacher_id, subject_id)
    select ${admin.id}, id from subjects where name in ('Maths', 'Science', 'Social')
    on conflict do nothing`;
  console.log(`Created admin login "${username}".`);
}
console.log("Database is ready.");
await sql.end();
