"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { sql } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { canTeach } from "@/lib/queries";
import { int, str, withMsg } from "@/lib/util";

export async function createSheet(fd: FormData) {
  await requireRole("admin");
  const back = "/teach/sheets";
  const number = int(fd, "number"), batchId = int(fd, "batch_id"), title = str(fd, "title"), due = str(fd, "due_on");
  if (!number || !batchId || !title) redirect(withMsg(back, "err", "Fill in the sheet number, title and batch."));
  const id = await sql.begin(async (tx) => {
    const [sh] = await tx`
      insert into sheets (number, title, batch_id, subject_id, body, due_on)
      values (${number}, ${title}, ${batchId}, ${int(fd, "subject_id")}, ${str(fd, "body")}, ${/^\d{4}-\d{2}-\d{2}$/.test(due) ? due : null})
      on conflict (number) do nothing returning id`;
    if (!sh) return null;
    await tx`
      insert into sheet_students (sheet_id, student_id)
      select ${sh.id}, st.user_id from students st join users u on u.id = st.user_id where st.batch_id = ${batchId} and u.active`;
    return sh.id as number;
  });
  if (!id) redirect(withMsg(back, "err", `Sheet number ${number} already exists.`));
  revalidatePath("/", "layout");
  redirect(withMsg(`/sheets/${id}`, "ok", "Sheet created and given to every student in the batch."));
}

export async function deleteSheet(fd: FormData) {
  await requireRole("admin");
  await sql`delete from sheets where id = ${int(fd, "id")}`;
  revalidatePath("/", "layout");
  redirect(withMsg("/teach/sheets", "ok", "Sheet deleted."));
}

// Teachers of the sheet's subject (and admin) tick who has finished it.
export async function updateSheetStatus(fd: FormData) {
  const s = await requireRole("admin", "teacher");
  const id = int(fd, "id");
  const [sh] = id ? await sql`select subject_id from sheets where id = ${id}` : [];
  if (!sh) redirect("/teach/sheets");
  // A sheet without a subject can be ticked by any teacher.
  if (sh.subject_id && !(await canTeach(s, sh.subject_id))) redirect(withMsg(`/sheets/${id}`, "err", "You don't teach that subject."));
  const rows = await sql`select student_id from sheet_students where sheet_id = ${id}`;
  await sql.begin(async (tx) => {
    for (const r of rows)
      await tx`update sheet_students set done = ${fd.has(`d_${r.student_id}`)} where sheet_id = ${id} and student_id = ${r.student_id}`;
  });
  revalidatePath("/", "layout");
  redirect(withMsg(`/sheets/${id}`, "ok", "Saved."));
}
