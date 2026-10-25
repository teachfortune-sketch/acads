"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { sql } from "@/lib/db";
import { requireRole, TEACHING } from "@/lib/auth";
import { batchStudents, canTeach } from "@/lib/queries";
import { int, str, withMsg } from "@/lib/util";

async function teacherFor(subjectId: number | null, back: string) {
  const s = await requireRole(...TEACHING);
  if (!subjectId || !(await canTeach(s, subjectId))) redirect(withMsg(back, "err", "You don't teach that subject."));
  return s;
}

const isDate = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d);

export async function createLecture(fd: FormData) {
  const batchId = int(fd, "batch_id"), subjectId = int(fd, "subject_id");
  const back = `/teach/new?batch=${batchId ?? ""}`;
  const s = await teacherFor(subjectId, back);
  const topic = str(fd, "topic"), date = str(fd, "held_on");
  if (!batchId || !topic || !isDate(date)) redirect(withMsg(back, "err", "Choose a batch and fill in the date and topic."));
  const students = await batchStudents(batchId);
  const id = await sql.begin(async (tx) => {
    const [l] = await tx`
      insert into lectures (batch_id, subject_id, teacher_id, held_on, topic, notes, homework)
      values (${batchId}, ${subjectId}, ${s.uid}, ${date}, ${topic}, ${str(fd, "notes")}, ${str(fd, "homework")})
      returning id`;
    for (const st of students)
      await tx`insert into attendance (lecture_id, student_id, present) values (${l.id}, ${st.id}, ${fd.has(`p_${st.id}`)})`;
    return l.id as number;
  });
  revalidatePath("/", "layout");
  redirect(withMsg(`/teach/lectures/${id}`, "ok", "Class saved. Absent students can now see the notes and homework."));
}

async function lectureForEdit(id: number | null) {
  const [l] = id ? await sql`select id, subject_id from lectures where id = ${id}` : [];
  if (!l) redirect("/teach");
  await teacherFor(l.subject_id, `/teach/lectures/${id}`);
  return l;
}

export async function updateLecture(fd: FormData) {
  const l = await lectureForEdit(int(fd, "id"));
  const back = `/teach/lectures/${l.id}`;
  const topic = str(fd, "topic"), date = str(fd, "held_on");
  if (!topic || !isDate(date)) redirect(withMsg(back, "err", "Fill in the date and topic."));
  const rows = await sql`select student_id from attendance where lecture_id = ${l.id}`;
  await sql.begin(async (tx) => {
    await tx`update lectures set topic = ${topic}, held_on = ${date}, notes = ${str(fd, "notes")}, homework = ${str(fd, "homework")} where id = ${l.id}`;
    for (const r of rows)
      await tx`update attendance set present = ${fd.has(`p_${r.student_id}`)}, homework_done = ${fd.has(`h_${r.student_id}`)}
        where lecture_id = ${l.id} and student_id = ${r.student_id}`;
  });
  revalidatePath("/", "layout");
  redirect(withMsg(back, "ok", "Saved."));
}

export async function deleteLecture(fd: FormData) {
  const l = await lectureForEdit(int(fd, "id"));
  await sql`delete from lectures where id = ${l.id}`;
  revalidatePath("/", "layout");
  redirect(withMsg("/teach", "ok", "Class deleted."));
}

function readMarks(fd: FormData, studentIds: number[], max: number) {
  const marks: [number, number | null][] = [];
  for (const id of studentIds) {
    const raw = str(fd, `m_${id}`);
    if (raw === "") { marks.push([id, null]); continue; }
    const v = Number(raw);
    if (!Number.isFinite(v) || v < 0 || v > max) return null;
    marks.push([id, v]);
  }
  return marks;
}

export async function createExam(fd: FormData) {
  const batchId = int(fd, "batch_id"), subjectId = int(fd, "subject_id");
  const back = `/teach/exams/new?batch=${batchId ?? ""}`;
  const s = await teacherFor(subjectId, back);
  const title = str(fd, "title"), date = str(fd, "held_on"), max = Number(str(fd, "max_marks"));
  if (!batchId || !title || !isDate(date) || !(max > 0)) redirect(withMsg(back, "err", "Fill in the test name, date and total marks."));
  const students = await batchStudents(batchId);
  const marks = readMarks(fd, students.map((x) => x.id), max);
  if (!marks) redirect(withMsg(back, "err", `Marks must be between 0 and ${max}.`));
  const id = await sql.begin(async (tx) => {
    const [e] = await tx`
      insert into exams (batch_id, subject_id, teacher_id, title, topic, held_on, max_marks)
      values (${batchId}, ${subjectId}, ${s.uid}, ${title}, ${str(fd, "topic")}, ${date}, ${max}) returning id`;
    for (const [sid, m] of marks) await tx`insert into exam_marks (exam_id, student_id, marks) values (${e.id}, ${sid}, ${m})`;
    return e.id as number;
  });
  revalidatePath("/", "layout");
  redirect(withMsg(`/teach/exams/${id}`, "ok", "Marks saved."));
}

async function examForEdit(id: number | null) {
  const [e] = id ? await sql`select id, subject_id, max_marks::float from exams where id = ${id}` : [];
  if (!e) redirect("/teach/exams");
  await teacherFor(e.subject_id, `/teach/exams/${id}`);
  return e;
}

export async function updateExam(fd: FormData) {
  const e = await examForEdit(int(fd, "id"));
  const back = `/teach/exams/${e.id}`;
  const rows = await sql`select student_id from exam_marks where exam_id = ${e.id}`;
  const marks = readMarks(fd, rows.map((r) => r.student_id), e.max_marks);
  if (!marks) redirect(withMsg(back, "err", `Marks must be between 0 and ${e.max_marks}.`));
  await sql.begin(async (tx) => {
    await tx`update exams set title = ${str(fd, "title") || "Test"}, topic = ${str(fd, "topic")} where id = ${e.id}`;
    for (const [sid, m] of marks) await tx`update exam_marks set marks = ${m} where exam_id = ${e.id} and student_id = ${sid}`;
  });
  revalidatePath("/", "layout");
  redirect(withMsg(back, "ok", "Marks saved."));
}

export async function deleteExam(fd: FormData) {
  const e = await examForEdit(int(fd, "id"));
  await sql`delete from exams where id = ${e.id}`;
  revalidatePath("/", "layout");
  redirect(withMsg("/teach/exams", "ok", "Test deleted."));
}

export async function createRemark(fd: FormData) {
  const subjectId = int(fd, "subject_id"), studentId = int(fd, "student_id");
  const back = `/teach/remarks?batch=${str(fd, "batch_id")}`;
  const s = await teacherFor(subjectId, back);
  const body = str(fd, "body");
  if (!studentId || !body) redirect(withMsg(back, "err", "Choose a student and write the remark."));
  await sql`insert into remarks (student_id, subject_id, author_id, body) values (${studentId}, ${subjectId}, ${s.uid}, ${body})`;
  revalidatePath("/", "layout");
  redirect(withMsg(back, "ok", "Remark saved. The student and parent can see it now."));
}
