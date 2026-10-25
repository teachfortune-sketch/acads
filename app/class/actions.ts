"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { sql } from "@/lib/db";
import { requireRole, TEACHING } from "@/lib/auth";
import { canTeach } from "@/lib/queries";
import { questLabel, setAttendance } from "@/lib/points";
import { int, str, todayIST, withMsg } from "@/lib/util";

// Starts today's class for a batch and subject: makes the class log (so notes, homework and the attendance
// percentages keep working) and marks everyone not already marked as present.
export async function startClass(fd: FormData) {
  const s = await requireRole(...TEACHING);
  const batchId = int(fd, "batch_id"), subjectId = int(fd, "subject_id");
  const back = `/class?batch=${batchId ?? ""}`;
  if (!batchId || !subjectId || !(await canTeach(s, subjectId))) redirect(withMsg(back, "err", "Choose a batch and one of your subjects."));
  const day = todayIST();
  const [existing] = await sql`select id from lectures where batch_id = ${batchId} and subject_id = ${subjectId} and held_on = ${day} order by id limit 1`;
  if (existing) redirect(`/class/${existing.id}`);
  const [sub] = await sql`select name from subjects where id = ${subjectId}`;
  const [plan] = await sql`select id, topic from schedule where kind = 'class' and batch_id = ${batchId} and subject_id = ${subjectId}
    and planned_on = ${day} and lecture_id is null order by id limit 1`;
  const id = await sql.begin(async (tx) => {
    const [l] = await tx`insert into lectures (batch_id, subject_id, teacher_id, held_on, topic)
      values (${batchId}, ${subjectId}, ${s.uid}, ${day}, ${plan?.topic ?? `${sub.name} class`}) returning id`;
    if (plan) await tx`update schedule set lecture_id = ${l.id} where id = ${plan.id}`;
    const roster = await tx`select st.user_id as id, d.status from students st join users u on u.id = st.user_id and u.active and u.status = 'approved'
      left join day_attendance d on d.student_id = st.user_id and d.day = ${day} where st.batch_id = ${batchId}`;
    for (const r of roster)
      await tx`insert into attendance (lecture_id, student_id, present) values (${l.id}, ${r.id}, ${r.status ? r.status === "present" || r.status === "late" : true})`;
    for (const r of roster.filter((r) => !r.status))
      await setAttendance(tx, { student: r.id, day, status: "present", actor: { uid: s.uid, role: s.role } });
    return l.id as number;
  });
  revalidatePath("/", "layout");
  redirect(`/class/${id}`);
}

async function lectureFor(id: number | null) {
  const s = await requireRole(...TEACHING);
  const [l] = id ? await sql`select l.id, l.batch_id, l.subject_id, l.held_on::text as day from lectures l where l.id = ${id}` : [];
  if (!l) redirect("/class");
  if (!(await canTeach(s, l.subject_id))) redirect(withMsg(`/class/${l.id}`, "err", "You don't teach this subject."));
  return { s, l };
}

export async function saveTopic(fd: FormData) {
  const { l } = await lectureFor(int(fd, "id"));
  const topic = str(fd, "topic");
  if (!topic) redirect(withMsg(`/class/${l.id}`, "err", "Write the topic you taught."));
  await sql`update lectures set topic = ${topic}, notes = ${str(fd, "notes")} where id = ${l.id}`;
  revalidatePath("/", "layout");
  redirect(withMsg(`/class/${l.id}`, "ok", "Topic and notes saved. Absent students can read them now."));
}

// One homework quest per batch per day. Whoever posted it (or an admin) can change it.
export async function postQuest(fd: FormData) {
  const { s, l } = await lectureFor(int(fd, "id"));
  const back = `/class/${l.id}`;
  const due = str(fd, "due_on");
  const q = { book: str(fd, "book"), chapter: str(fd, "chapter"), exercise: str(fd, "exercise"), questions: str(fd, "questions"), note: str(fd, "note") };
  // A syllabus chapter fills in the book and chapter, so every quest reads the same way.
  const chapterId = int(fd, "chapter_id");
  const [syl] = chapterId ? await sql`select book, no, name from syllabus_chapters where id = ${chapterId} and subject_id = ${l.subject_id}` : [];
  if (syl) {
    q.book = `NCERT ${String(syl.book).replace(/ – Part \d/, "")}`;
    q.chapter = `${syl.no} · ${syl.name}`;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(due) || due <= l.day) redirect(withMsg(back, "err", "Homework must be due on a later day."));
  if (!q.book || !(q.chapter || q.note)) redirect(withMsg(back, "err", "Choose the book and fill in the chapter (or a note for free tasks)."));
  const [other] = await sql`select q.posted_by, u.name, sub.name as subject from quests q join users u on u.id = q.posted_by join subjects sub on sub.id = q.subject_id
    where q.batch_id = ${l.batch_id} and q.due_on = ${due}`;
  if (other && other.posted_by !== s.uid && s.role !== "admin")
    redirect(withMsg(back, "err", `${other.name} already set ${other.subject} homework for that day. There is one homework quest per batch per day.`));
  await sql.begin(async (tx) => {
    await tx`insert into quests (batch_id, subject_id, due_on, book, chapter, exercise, questions, note, lecture_id, posted_by, chapter_id)
      values (${l.batch_id}, ${l.subject_id}, ${due}, ${q.book}, ${q.chapter}, ${q.exercise}, ${q.questions}, ${q.note}, ${l.id}, ${s.uid}, ${syl ? chapterId : null})
      on conflict (batch_id, due_on) do update set subject_id = excluded.subject_id, book = excluded.book, chapter = excluded.chapter, chapter_id = excluded.chapter_id,
        exercise = excluded.exercise, questions = excluded.questions, note = excluded.note, lecture_id = excluded.lecture_id, posted_by = excluded.posted_by`;
    // The class log shows it as this class's homework too.
    await tx`update lectures set homework = ${[questLabel(q), q.note].filter(Boolean).join(". ")} where id = ${l.id}`;
  });
  revalidatePath("/", "layout");
  redirect(withMsg(back, "ok", "Homework posted. Students see it on their home page tonight."));
}
