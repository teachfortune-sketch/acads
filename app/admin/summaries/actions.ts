"use server";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { sql } from "@/lib/db";

// Logged when the office taps WhatsApp or SMS for a parent, so they can see who is left this week.
export async function markSummarySent(student: number, week: string, channel: "whatsapp" | "sms") {
  const s = await requireRole("admin");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(week) || !["whatsapp", "sms"].includes(channel)) return;
  await sql`insert into parent_summaries (student_id, week_start, channel, sent_by) values (${student}, ${week}, ${channel}, ${s.uid})
    on conflict (student_id, week_start) do update set channel = excluded.channel, sent_by = excluded.sent_by, at = now()`;
  revalidatePath("/admin/summaries");
}
