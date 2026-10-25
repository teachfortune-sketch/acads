"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { sql } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { amount, int, PAY_MODES, str, todayIST, withMsg } from "@/lib/util";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const page = (id: number) => `/admin/fees/${id}`;

async function studentFrom(fd: FormData) {
  const id = int(fd, "student_id");
  const [st] = id ? await sql`select user_id from students where user_id = ${id}` : [];
  if (!st) redirect(withMsg("/admin/fees", "err", "Student not found."));
  return st.user_id as number;
}

function done(id: number, text: string): never {
  revalidatePath("/admin/fees");
  revalidatePath(page(id));
  redirect(withMsg(page(id), "ok", text));
}

export async function createPlan(fd: FormData) {
  const s = await requireRole("admin");
  const sid = await studentFrom(fd);
  const title = str(fd, "title"), total = amount(fd, "total"), first = str(fd, "first_due");
  const count = int(fd, "count") ?? 1, gap = int(fd, "gap") ?? 1;
  if (!title || !total || !DATE_RE.test(first) || count > 12 || ![1, 2, 3, 6, 12].includes(gap))
    redirect(withMsg(page(sid), "err", "Fill in the plan name, total fee and first due date."));
  if (total < count) redirect(withMsg(page(sid), "err", "The total is too small for that many installments."));
  // Equal parts; any leftover rupees go on the first installment.
  const part = Math.floor(total / count);
  const parts = Array.from({ length: count }, (_, n) => (n === 0 ? total - part * (count - 1) : part));
  await sql.begin(async (tx) => {
    const [p] = await tx`insert into fee_plans (student_id, title, created_by) values (${sid}, ${title}, ${s.uid}) returning id`;
    for (const [n, amt] of parts.entries())
      await tx`insert into fee_installments (plan_id, due_on, amount)
        values (${p.id}, (${first}::date + make_interval(months => ${n * gap}))::date, ${amt})`;
  });
  done(sid, `Fee plan “${title}” added.`);
}

export async function cancelPlan(fd: FormData) {
  const s = await requireRole("admin");
  const sid = await studentFrom(fd);
  const reason = str(fd, "reason");
  if (!reason) redirect(withMsg(page(sid), "err", "Write why the plan is being cancelled."));
  await sql`update fee_plans set cancelled_at = now(), cancelled_by = ${s.uid}, cancel_reason = ${reason}
    where id = ${int(fd, "plan_id")} and student_id = ${sid} and cancelled_at is null`;
  done(sid, "Plan cancelled. It stays in the history.");
}

export async function recordPayment(fd: FormData) {
  const s = await requireRole("admin");
  const sid = await studentFrom(fd);
  const amt = amount(fd, "amount"), paidOn = str(fd, "paid_on"), mode = str(fd, "mode"), token = str(fd, "token");
  if (!amt) redirect(withMsg(page(sid), "err", "Enter the amount received in whole rupees."));
  if (!DATE_RE.test(paidOn) || paidOn > todayIST()) redirect(withMsg(page(sid), "err", "The payment date can't be in the future."));
  if (!(PAY_MODES as readonly string[]).includes(mode)) redirect(withMsg(page(sid), "err", "Choose how it was paid."));
  const reference = str(fd, "reference");
  if (mode !== "Cash" && !reference) redirect(withMsg(page(sid), "err", `Enter the ${mode} reference number.`));
  const id = await sql.begin(async (tx) => {
    // Lock so two receipts can never get the same number.
    await tx`lock table fee_payments in share row exclusive mode`;
    const [dup] = token ? await tx`select id from fee_payments where form_token = ${token}` : [];
    if (dup) return dup.id as number;
    const [{ next }] = await tx`select coalesce(max(receipt_no), 0) + 1 as next from fee_payments`;
    const [p] = await tx`
      insert into fee_payments (receipt_no, student_id, amount, paid_on, mode, reference, note, form_token, created_by)
      values (${next}, ${sid}, ${amt}, ${paidOn}, ${mode}, ${reference}, ${str(fd, "note")}, ${token || null}, ${s.uid})
      returning id`;
    return p.id as number;
  });
  revalidatePath("/admin/fees");
  revalidatePath(page(sid));
  redirect(withMsg(`/fees/receipt/${id}`, "ok", "Payment saved."));
}

export async function reversePayment(fd: FormData) {
  const s = await requireRole("admin");
  const sid = await studentFrom(fd);
  const reason = str(fd, "reason");
  if (!reason) redirect(withMsg(page(sid), "err", "Write why the receipt is being reversed."));
  await sql`update fee_payments set reversed_at = now(), reversed_by = ${s.uid}, reversal_reason = ${reason}
    where id = ${int(fd, "id")} and student_id = ${sid} and reversed_at is null`;
  done(sid, "Receipt reversed. The original entry is kept.");
}

export async function addConcession(fd: FormData) {
  const s = await requireRole("admin");
  const sid = await studentFrom(fd);
  const amt = amount(fd, "amount"), reason = str(fd, "reason");
  if (!amt || !reason) redirect(withMsg(page(sid), "err", "Enter the concession amount and the reason."));
  await sql`insert into fee_concessions (student_id, amount, reason, created_by) values (${sid}, ${amt}, ${reason}, ${s.uid})`;
  done(sid, "Concession added.");
}

export async function reverseConcession(fd: FormData) {
  const s = await requireRole("admin");
  const sid = await studentFrom(fd);
  const reason = str(fd, "reason");
  if (!reason) redirect(withMsg(page(sid), "err", "Write why the concession is being reversed."));
  await sql`update fee_concessions set reversed_at = now(), reversed_by = ${s.uid}, reversal_reason = ${reason}
    where id = ${int(fd, "id")} and student_id = ${sid} and reversed_at is null`;
  done(sid, "Concession reversed. The original entry is kept.");
}
