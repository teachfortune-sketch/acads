"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { sql } from "@/lib/db";
import { requireRole, TEACHING } from "@/lib/auth";
import { batchStudents, canTeach } from "@/lib/queries";
import { int, str, withMsg } from "@/lib/util";

export async function createTask(fd: FormData) {
  const s = await requireRole(...TEACHING);
  const batchId = int(fd, "batch_id"), subjectId = int(fd, "subject_id");
  const back = `/teach/tasks?batch=${batchId ?? ""}`;
  if (!subjectId || !(await canTeach(s, subjectId))) redirect(withMsg(back, "err", "You don't teach that subject."));
  const title = str(fd, "title"), due = str(fd, "due_on");
  if (!batchId || !title) redirect(withMsg(back, "err", "Write what the task is."));
  const chosen = (await batchStudents(batchId)).filter((st) => fd.has(`s_${st.id}`));
  if (!chosen.length) redirect(withMsg(back, "err", "Choose at least one student."));
  const lectureId = int(fd, "lecture_id");
  const id = await sql.begin(async (tx) => {
    const [t] = await tx`
      insert into tasks (lecture_id, batch_id, subject_id, teacher_id, title, details, due_on)
      values (${lectureId}, ${batchId}, ${subjectId}, ${s.uid}, ${title}, ${str(fd, "details")}, ${/^\d{4}-\d{2}-\d{2}$/.test(due) ? due : null})
      returning id`;
    for (const st of chosen) await tx`insert into task_students (task_id, student_id) values (${t.id}, ${st.id})`;
    return t.id as number;
  });
  revalidatePath("/", "layout");
  redirect(withMsg(`/teach/tasks/${id}`, "ok", `Task given to ${chosen.length} student${chosen.length > 1 ? "s" : ""}.`));
}

async function taskForEdit(id: number | null) {
  const s = await requireRole(...TEACHING);
  const [t] = id ? await sql`select id, subject_id from tasks where id = ${id}` : [];
  if (!t) redirect("/teach/tasks");
  if (!(await canTeach(s, t.subject_id))) redirect(withMsg(`/teach/tasks/${t.id}`, "err", "You don't teach that subject."));
  return t;
}

export async function updateTaskStatus(fd: FormData) {
  const t = await taskForEdit(int(fd, "id"));
  const rows = await sql`select student_id from task_students where task_id = ${t.id}`;
  await sql.begin(async (tx) => {
    for (const r of rows)
      await tx`update task_students set done = ${fd.has(`d_${r.student_id}`)} where task_id = ${t.id} and student_id = ${r.student_id}`;
  });
  revalidatePath("/", "layout");
  redirect(withMsg(`/teach/tasks/${t.id}`, "ok", "Saved."));
}

export async function deleteTask(fd: FormData) {
  const t = await taskForEdit(int(fd, "id"));
  await sql`delete from tasks where id = ${t.id}`;
  revalidatePath("/", "layout");
  redirect(withMsg("/teach/tasks", "ok", "Task deleted."));
}
