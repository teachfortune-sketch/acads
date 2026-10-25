"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { sql } from "@/lib/db";
import { int, str, withMsg } from "@/lib/util";

const back = "/planner";
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const done = (msg: string) => {
  revalidatePath("/", "layout");
  redirect(withMsg(back, "ok", msg));
};

export async function addBlock(fd: FormData) {
  const s = await requireRole("student");
  const weekday = int(fd, "weekday"), starts = str(fd, "starts"), ends = str(fd, "ends"), subject = int(fd, "subject_id");
  if (weekday == null || weekday < 0 || weekday > 6) redirect(withMsg(back, "err", "Pick a day."));
  if (!TIME.test(starts) || !TIME.test(ends) || ends <= starts) redirect(withMsg(back, "err", "Give a start and end time, with the end after the start."));
  const [{ n }] = await sql`select count(*)::int as n from routine_blocks where student_id = ${s.uid}`;
  if (n >= 60) redirect(withMsg(back, "err", "That's a lot of blocks already. Remove some first."));
  await sql`insert into routine_blocks (student_id, weekday, starts, ends, subject_id, note)
    values (${s.uid}, ${weekday}, ${starts}, ${ends}, ${subject || null}, ${str(fd, "note").slice(0, 60)})`;
  done("Added to your routine.");
}

export async function deleteBlock(fd: FormData) {
  const s = await requireRole("student");
  await sql`delete from routine_blocks where id = ${int(fd, "id") ?? 0} and student_id = ${s.uid}`;
  done("Removed from your routine.");
}

export async function addTask(fd: FormData) {
  const s = await requireRole("student");
  const text = str(fd, "text").slice(0, 200);
  const chapterId = int(fd, "chapter_id");
  let subject = int(fd, "subject_id");
  if (chapterId) {
    const [c] = await sql`select subject_id from syllabus_chapters where id = ${chapterId}`;
    if (c) subject = c.subject_id;
  }
  if (!subject) redirect(withMsg(back, "err", "Pick the subject (or a chapter)."));
  if (!text) redirect(withMsg(back, "err", "Write what you will study, e.g. “Revise Ex 4.2 Q1–10”."));
  await sql`insert into study_tasks (student_id, subject_id, chapter_id, text, shared)
    values (${s.uid}, ${subject}, ${chapterId || null}, ${text}, ${fd.get("shared") === "on"})`;
  done("Task added. Tick it when you've done it; your teacher checks your notebook to award XP.");
}

// Ticking a task as done earns nothing by itself; the teacher's check does.
export async function toggleTask(fd: FormData) {
  const s = await requireRole("student");
  await sql`update study_tasks set done_at = case when done_at is null then now() else null end
    where id = ${int(fd, "id") ?? 0} and student_id = ${s.uid} and verdict is null`;
  revalidatePath("/", "layout");
}

export async function shareTask(fd: FormData) {
  const s = await requireRole("student");
  await sql`update study_tasks set shared = not shared where id = ${int(fd, "id") ?? 0} and student_id = ${s.uid} and verdict is null`;
  revalidatePath("/", "layout");
}

export async function deleteTask(fd: FormData) {
  const s = await requireRole("student");
  const [t] = await sql`delete from study_tasks where id = ${int(fd, "id") ?? 0} and student_id = ${s.uid} and verdict is null returning id`;
  if (!t) redirect(withMsg(back, "err", "A checked task stays on your record."));
  done("Task removed.");
}
