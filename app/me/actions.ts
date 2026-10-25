"use server";
import { revalidatePath } from "next/cache";
import { sql } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { int } from "@/lib/util";

// Students tick their own tasks and sheets.
export async function toggleTask(fd: FormData) {
  const s = await requireRole("student");
  await sql`update task_students set done = not done where task_id = ${int(fd, "id")} and student_id = ${s.uid}`;
  revalidatePath("/", "layout");
}

export async function toggleSheet(fd: FormData) {
  const s = await requireRole("student");
  await sql`update sheet_students set done = not done where sheet_id = ${int(fd, "id")} and student_id = ${s.uid}`;
  revalidatePath("/", "layout");
}
