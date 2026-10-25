// Adds sample teachers, students, parents, classes and tests so you can try the site.
// Every demo login uses the password "demo123". Do not run this on your real database.
import postgres from "postgres";
import bcrypt from "bcryptjs";

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
console.log('Demo data added. Logins: aarav, diya, kabir, meera, rohan (and <name>.parent), hindi.teacher, english.teacher. Password: demo123');
await sql.end();
