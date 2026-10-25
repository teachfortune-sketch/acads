"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { sql } from "@/lib/db";
import { requireRole, TEACHING } from "@/lib/auth";
import { canTeach } from "@/lib/queries";
import { int, str, withMsg } from "@/lib/util";

const isDate = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d);

export async function createPlan(fd: FormData) {
  const s = await requireRole(...TEACHING);
  const batchId = int(fd, "batch_id"), subjectId = int(fd, "subject_id");
  const date = str(fd, "planned_on"), topic = str(fd, "topic");
  const kind = str(fd, "kind") === "test" ? "test" : "class";
  const back = `/teach/calendar?month=${date.slice(0, 7)}`;
  if (!subjectId || !(await canTeach(s, subjectId))) redirect(withMsg(back, "err", "You don't teach that subject."));
  if (!batchId || !isDate(date) || !topic) redirect(withMsg(back, "err", "Choose a batch and fill in the date and topic."));
  await sql`
    insert into schedule (kind, batch_id, subject_id, teacher_id, planned_on, start_time, topic, prerequisites)
    values (${kind}, ${batchId}, ${subjectId}, ${s.uid}, ${date}, ${str(fd, "start_time")}, ${topic}, ${str(fd, "prerequisites")})`;
  revalidatePath("/", "layout");
  redirect(withMsg(back, "ok", `${kind === "test" ? "Test" : "Class"} added to the calendar.`));
}

async function planForEdit(id: number | null) {
  const s = await requireRole(...TEACHING);
  const [p] = id ? await sql`select id, subject_id, planned_on::text from schedule where id = ${id}` : [];
  if (!p) redirect("/teach/calendar");
  if (!(await canTeach(s, p.subject_id))) redirect(withMsg(`/teach/plan/${p.id}`, "err", "You don't teach that subject."));
  return p;
}

export async function updatePlan(fd: FormData) {
  const p = await planForEdit(int(fd, "id"));
  const date = str(fd, "planned_on"), topic = str(fd, "topic");
  if (!isDate(date) || !topic) redirect(withMsg(`/teach/plan/${p.id}`, "err", "Fill in the date and topic."));
  await sql`update schedule set planned_on = ${date}, start_time = ${str(fd, "start_time")}, topic = ${topic},
    prerequisites = ${str(fd, "prerequisites")} where id = ${p.id}`;
  revalidatePath("/", "layout");
  redirect(withMsg(`/teach/plan/${p.id}`, "ok", "Saved."));
}

export async function deletePlan(fd: FormData) {
  const p = await planForEdit(int(fd, "id"));
  await sql`delete from schedule where id = ${p.id}`;
  revalidatePath("/", "layout");
  redirect(withMsg(`/teach/calendar?month=${p.planned_on.slice(0, 7)}`, "ok", "Removed from the calendar."));
}
