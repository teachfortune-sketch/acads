"use server";
import { revalidatePath } from "next/cache";
import { requireRole, TEACHING } from "@/lib/auth";
import { sql } from "@/lib/db";
import { canTeach } from "@/lib/queries";
import { int } from "@/lib/util";

// Tick or untick a chapter as taught for one class. Teachers only for subjects they teach.
export async function toggleTaught(fd: FormData) {
  const s = await requireRole(...TEACHING);
  const batch = int(fd, "batch_id"), chapter = int(fd, "chapter_id");
  if (!batch || !chapter) return;
  const [c] = await sql`select subject_id from syllabus_chapters where id = ${chapter}`;
  if (!c || !(await canTeach(s, c.subject_id))) return;
  const [gone] = await sql`delete from taught_marks where batch_id = ${batch} and chapter_id = ${chapter} returning chapter_id`;
  if (!gone) await sql`insert into taught_marks (batch_id, chapter_id, teacher_id) values (${batch}, ${chapter}, ${s.uid}) on conflict do nothing`;
  revalidatePath("/", "layout");
}
