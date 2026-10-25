// Adds sample teachers, students, parents, classes and tests so you can try the site.
// Every demo login uses the password "demo123". Do not run this on your real database.
import postgres from "postgres";
import bcrypt from "bcryptjs";

// Read .env.local when it exists; variables already set in the shell win.
try {
  process.loadEnvFile(".env.local");
} catch {}

const sql = postgres(process.env.DATABASE_URL, { prepare: false, max: 1, onnotice: () => {} });
const hash = await bcrypt.hash("demo123", 10);
const id = async (q) => (await q)[0]?.id;
const user = (username, name, role) =>
  id(sql`insert into users (username, password_hash, name, role) values (${username}, ${hash}, ${name}, ${role})
    on conflict (username) do update set name = excluded.name returning id`);

const subj = Object.fromEntries((await sql`select id, name from subjects`).map((r) => [r.name, r.id]));
const batch = Object.fromEntries((await sql`select id, name from batches`).map((r) => [r.name, r.id]));
const [admin] = await sql`select id from users where role = 'admin' order by id limit 1`;

const hindi = await user("hindi.teacher", "Hindi teacher", "teacher");
const english = await user("english.teacher", "English teacher", "teacher");
await sql`insert into teacher_subjects values (${hindi}, ${subj.Hindi}), (${english}, ${subj.English}) on conflict do nothing`;
const teacherOf = { Maths: admin.id, Science: admin.id, Social: admin.id, Hindi: hindi, English: english };

let seed = 7;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
const kids = [
  ["aarav", "Aarav Sharma", "Class 9", 0.95, 0.85], ["diya", "Diya Patel", "Class 9", 0.9, 0.75],
  ["kabir", "Kabir Singh", "Class 9", 0.7, 0.5], ["meera", "Meera Iyer", "Class 7", 0.97, 0.9], ["rohan", "Rohan Gupta", "Class 7", 0.8, 0.62],
];
for (const [u, name, b, att, skill] of kids) {
  const sid = await user(u, name, "student");
  const pid = await user(`${u}.parent`, `${name.split(" ")[1]} family`, "parent");
  await sql`insert into students (user_id, batch_id, parent_id) values (${sid}, ${batch[b]}, ${pid}) on conflict (user_id) do nothing`;
  Object.assign(kids.find((k) => k[0] === u), { sid, att, skill, b });
}

const topics = {
  Maths: ["Integers", "Fractions and decimals", "Linear equations", "Polynomials", "Triangles"],
  Science: ["Nutrition in plants", "Heat", "Acids, bases and salts", "Atoms and molecules", "Motion"],
  Social: ["Tracing changes through a thousand years", "Our environment", "The French Revolution", "India: size and location", "What is democracy?"],
  Hindi: ["Hum panchhi unmukt gagan ke", "Dadi maa", "Do bailon ki katha", "Vyakaran: sangya", "Patra lekhan"],
  English: ["Three questions", "A gift of chappals", "The fun they had", "Grammar: tenses", "Letter writing"],
};
for (const b of ["Class 7", "Class 9"]) {
  const members = kids.filter((k) => k.b === b);
  for (let d = 0; d < 12; d++) {
    const date = new Date(Date.UTC(2026, 9, 6 + d + Math.floor(d / 6))).toISOString().slice(0, 10);
    for (const s of [Object.keys(topics)[d % 5], Object.keys(topics)[(d + 2) % 5]]) {
      const topic = topics[s][Math.min(Math.floor(d / 3), 4)];
      const lid = await id(sql`insert into lectures (batch_id, subject_id, teacher_id, held_on, topic, notes, homework)
        values (${batch[b]}, ${subj[s]}, ${teacherOf[s]}, ${date}, ${topic}, ${`Covered ${topic}: key points and two solved examples. Read the textbook pages for this chapter.`}, ${`Exercise questions on ${topic}`}) returning id`);
      for (const k of members) {
        const present = rnd() < k.att;
        await sql`insert into attendance values (${lid}, ${k.sid}, ${present}, ${rnd() < k.att})`;
      }
    }
  }
  for (const s of Object.keys(topics)) {
    const eid = await id(sql`insert into exams (batch_id, subject_id, teacher_id, title, topic, held_on, max_marks)
      values (${batch[b]}, ${subj[s]}, ${teacherOf[s]}, 'Weekly test 1', ${topics[s][0] + ", " + topics[s][1]}, '2026-10-17', 25) returning id`);
    for (const k of members) {
      const m = rnd() < k.att + 0.05 ? Math.max(3, Math.min(25, Math.round(25 * (k.skill + (rnd() - 0.5) * 0.3)))) : null;
      await sql`insert into exam_marks values (${eid}, ${k.sid}, ${m})`;
    }
  }
}
await sql`insert into notices (author_id, body) values (${admin.id}, 'Half-yearly exams start 9 November. The revision timetable will be shared on Monday.')`;
await sql`insert into notices (author_id, batch_id, body) values (${admin.id}, ${batch["Class 9"]}, 'Class 9: bring your maths test copies on Tuesday.')`;
await sql`insert into remarks (student_id, subject_id, author_id, body) values (${kids[2].sid}, ${subj.Maths}, ${admin.id}, 'Understands the method but makes sign errors. Needs daily practice of 10 sums.')`;
// Questboard: a reception login, roll numbers, and two weeks of points for Class 9 so the home page and leaderboard have something to show.
await user("reception", "Front desk", "reception");
let roll = 1;
for (const k of kids) await sql`update students set roll_no = ${String(roll++)}, section = 'A', school = 'Demo Public School' where user_id = ${k.sid}`;
const class9 = kids.filter((k) => k.b === "Class 9");
const days = [];
for (let d = new Date(Date.UTC(2026, 9, 12)); days.length < 10; d.setUTCDate(d.getUTCDate() + 1)) if (d.getUTCDay() !== 0) days.push(d.toISOString().slice(0, 10));
const pt = (sid, pillar, action, xp, reason, day, quest = null) =>
  sql`insert into points (student_id, pillar, action, xp, reason, staff_id, quest_id, day, created_at)
    values (${sid}, ${pillar}, ${action}, ${xp}, ${reason}, ${admin.id}, ${quest}, ${day}, ${day + "T10:00:00+05:30"})`;
for (const [i, day] of days.entries()) {
  const [q] = await sql`insert into quests (batch_id, subject_id, due_on, book, chapter, exercise, questions, posted_by)
    values (${batch["Class 9"]}, ${subj.Maths}, ${day}, 'NCERT Ganita Manjari', ${`${1 + Math.floor(i / 3)}`}, ${`${1 + Math.floor(i / 3)}.${1 + (i % 3)}`}, '1–8', ${admin.id})
    on conflict (batch_id, due_on) do nothing returning id`;
  if (!q) continue;
  for (const k of class9) {
    const status = rnd() < k.att ? (rnd() < 0.15 ? "late" : "present") : "absent";
    await sql`insert into day_attendance (student_id, day, batch_id, status, arrived_at, marked_by)
      values (${k.sid}, ${day}, ${batch["Class 9"]}, ${status}, ${status === "late" ? "09:1" + Math.floor(rnd() * 9) : ""}, ${admin.id}) on conflict do nothing`;
    if (status === "present") await pt(k.sid, "attendance", "att_present", 10, "Present on time", day);
    else if (status === "late") await pt(k.sid, "attendance", "att_late", 5, "Late", day);
    else await pt(k.sid, "attendance", "att_absent", 0, "Absent", day);
    const done = rnd() < k.skill + 0.1, stars = done ? Math.min(3, Math.floor(rnd() * 4 * k.skill)) : 0;
    await sql`insert into quest_checks (quest_id, student_id, done, stars, checked_by) values (${q.id}, ${k.sid}, ${done}, ${stars}, ${admin.id})`;
    await pt(k.sid, "homework", done ? "hw_done" : "hw_missed", done ? 10 + 5 * stars : 0, done ? `Homework done${stars ? " " + "★".repeat(stars) : ""}` : "Homework not done", day, q.id);
    if (rnd() < k.skill * 0.6) await pt(k.sid, "presence", "answered", 5, "Answered a question", day);
    if (rnd() < 0.08) await pt(k.sid, "discipline", "disc_uniform", -5, "Uniform", day);
  }
}

console.log('Demo data added. Logins: aarav, diya, kabir, meera, rohan (and <name>.parent), hindi.teacher, english.teacher, reception. Password: demo123');
await sql.end();
