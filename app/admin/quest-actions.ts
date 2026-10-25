"use server";
import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { sql } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { RULES, RuleKey, undoPoint, PointsError } from "@/lib/points";
import { int, str, withMsg } from "@/lib/util";

const APPROVALS = "/admin/approvals";

export async function approveSignup(fd: FormData) {
  await requireRole("admin");
  const id = int(fd, "id");
  const [u] = await sql`update users set status = 'approved', active = true, reject_reason = ''
    where id = ${id} and role = 'student' and status <> 'approved' returning name`;
  if (!u) redirect(withMsg(APPROVALS, "err", "That sign-up was already handled."));
  // A newly approved student gets the batch's worksheets like everyone else.
  await sql`insert into sheet_students (sheet_id, student_id)
    select sh.id, st.user_id from sheets sh join students st on st.batch_id = sh.batch_id where st.user_id = ${id} on conflict do nothing`;
  revalidatePath("/", "layout");
  redirect(withMsg(APPROVALS, "ok", `${u.name} approved and added to the class roster.`));
}

export async function rejectSignup(fd: FormData) {
  await requireRole("admin");
  const reason = str(fd, "reason");
  if (!reason) redirect(withMsg(APPROVALS, "err", "Write a short reason so the student knows what to do."));
  const [u] = await sql`update users set status = 'rejected', active = false, reject_reason = ${reason}
    where id = ${int(fd, "id")} and role = 'student' and status = 'pending' returning name`;
  revalidatePath("/", "layout");
  redirect(withMsg(APPROVALS, u ? "ok" : "err", u ? `${u.name}'s sign-up was rejected.` : "That sign-up was already handled."));
}

// The office sets a temporary password; the person must choose their own at next sign-in.
export async function setTempPassword(fd: FormData) {
  const s = await requireRole("admin");
  const reqId = int(fd, "request_id");
  const password = str(fd, "password");
  if (password.length < 6) redirect(withMsg(APPROVALS, "err", "The temporary password must be at least 6 characters."));
  const [r] = await sql`select user_id from reset_requests where id = ${reqId} and handled_at is null`;
  if (!r) redirect(withMsg(APPROVALS, "err", "That request was already handled."));
  await sql.begin(async (tx) => {
    await tx`update users set password_hash = ${await bcrypt.hash(password, 10)}, must_change_password = true,
      session_version = session_version + 1, failed_logins = 0, locked_until = null where id = ${r.user_id}`;
    await tx`update reset_requests set handled_at = now(), handled_by = ${s.uid} where id = ${reqId}`;
  });
  revalidatePath(APPROVALS);
  redirect(withMsg(APPROVALS, "ok", "Temporary password set. Give it to them; they'll choose a new one when they sign in."));
}

export async function dismissReset(fd: FormData) {
  const s = await requireRole("admin");
  await sql`update reset_requests set handled_at = now(), handled_by = ${s.uid} where id = ${int(fd, "request_id")} and handled_at is null`;
  revalidatePath(APPROVALS);
  redirect(APPROVALS);
}

export async function saveRules(fd: FormData) {
  await requireRole("admin");
  const back = "/admin/points";
  for (const [k, r] of Object.entries(RULES) as [RuleKey, (typeof RULES)[RuleKey]][]) {
    const raw = str(fd, k);
    if (raw === "") continue;
    if (typeof r.def === "number") {
      const n = Number(raw);
      if (!Number.isInteger(n) || n < 0 || n > 1000) redirect(withMsg(back, "err", `${r.label}: use a whole number from 0 to 1000.`));
    } else if (k === "term_start" ? !/^\d{4}-\d{2}-\d{2}$/.test(raw) : !/^([01]\d|2[0-3]):[0-5]\d$/.test(raw)) {
      redirect(withMsg(back, "err", `${r.label}: check the format.`));
    }
    await sql`insert into point_rules (key, value) values (${k}, ${raw}) on conflict (key) do update set value = excluded.value`;
  }
  revalidatePath("/", "layout");
  redirect(withMsg(back, "ok", "Point rules saved. New entries use them from now on; earlier points stay as they were."));
}

export async function reversePoint(fd: FormData) {
  const s = await requireRole("admin");
  const studentId = int(fd, "student_id");
  try {
    await sql.begin((tx) => undoPoint(tx, int(fd, "id") ?? 0, s, str(fd, "note")));
  } catch (e) {
    if (e instanceof PointsError) redirect(withMsg(`/students/${studentId}`, "err", e.message) + "#points");
    throw e;
  }
  revalidatePath("/", "layout");
  redirect(withMsg(`/students/${studentId}`, "ok", "Entry reversed.") + "#points");
}
