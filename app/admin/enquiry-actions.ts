"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { sql } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { ENQUIRY_STATUSES as STATUSES, int, str, withMsg } from "@/lib/util";


export async function updateEnquiry(fd: FormData) {
  await requireRole("admin");
  const id = int(fd, "id");
  const status = str(fd, "status");
  const next = str(fd, "next_follow_up");
  if (!id || !(STATUSES as readonly string[]).includes(status)) redirect(withMsg("/admin/enquiries", "err", "Choose a status."));
  await sql`update enquiries set status = ${status}, next_follow_up = ${/^\d{4}-\d{2}-\d{2}$/.test(next) ? next : null},
    notes = ${str(fd, "notes")} where id = ${id}`;
  revalidatePath("/admin/enquiries");
  redirect(withMsg(`/admin/enquiries${str(fd, "filter") ? `?status=${encodeURIComponent(str(fd, "filter"))}` : ""}`, "ok", "Enquiry updated."));
}
