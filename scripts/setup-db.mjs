// Creates the tables, the Class 6–10 batches, the five subjects and the first admin login.
// Usage: DATABASE_URL=... ADMIN_PASSWORD=... node scripts/setup-db.mjs  (admin username defaults to "rahul")
import { readdirSync, readFileSync } from "node:fs";
import postgres from "postgres";
import bcrypt from "bcryptjs";

// Read .env.local when it exists; variables already set in the shell win.
try {
  process.loadEnvFile(".env.local");
} catch {}

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
  const username = (process.env.ADMIN_USERNAME || "rahul").toLowerCase();
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
// Sync worksheets from the sheets/ folder and assign each to its batch.
const sheetDir = new URL("../sheets/", import.meta.url);
for (const file of readdirSync(sheetDir).filter((f) => f.endsWith(".md") && f !== "README.md")) {
  const text = readFileSync(new URL(file, sheetDir), "utf8");
  const m = text.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) { console.warn(`Skipped ${file}: no --- header.`); continue; }
  const meta = Object.fromEntries(m[1].split("\n").map((l) => l.split(/:(.*)/s).map((x) => x.trim())).filter((kv) => kv[0]));
  const number = Number(meta.number);
  const [batch] = await sql`select id from batches where lower(name) = lower(${meta.batch ?? ""})`;
  if (!Number.isInteger(number) || !meta.title || !batch) { console.warn(`Skipped ${file}: needs number, title and a valid batch.`); continue; }
  const [subject] = meta.subject ? await sql`select id from subjects where lower(name) = lower(${meta.subject})` : [];
  const due = /^\d{4}-\d{2}-\d{2}$/.test(meta.due ?? "") ? meta.due : null;
  const [before] = await sql`select batch_id from sheets where number = ${number}`;
  const [sheet] = await sql`
    insert into sheets (number, title, batch_id, subject_id, body, due_on)
    values (${number}, ${meta.title}, ${batch.id}, ${subject?.id ?? null}, ${m[2].trim()}, ${due})
    on conflict (number) do update set title = excluded.title, batch_id = excluded.batch_id,
      subject_id = excluded.subject_id, body = excluded.body, due_on = excluded.due_on
    returning id`;
  // Moved to another batch: the old batch no longer has this sheet.
  if (before && before.batch_id !== batch.id) await sql`delete from sheet_students where sheet_id = ${sheet.id}`;
  console.log(`Sheet ${number} synced.`);
}
// Give every sheet to students who joined its batch later, including sheets made on the site.
await sql`
  insert into sheet_students (sheet_id, student_id)
  select sh.id, st.user_id from sheets sh join students st on st.batch_id = sh.batch_id join users u on u.id = st.user_id
  where u.active
  on conflict do nothing`;
console.log("Database is ready.");
await sql.end();
