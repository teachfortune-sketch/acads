import { sql } from "@/lib/db";
import { todayIST } from "@/lib/util";

export type Installment = { id: number; plan_id: number; due_on: string; amount: number; covered: number; state: "Paid" | "Part paid" | "Overdue" | "Due" };
export type Plan = { id: number; title: string; created_at: Date; cancelled_at: Date | null; cancel_reason: string; installments: Installment[] };
export type Entry = {
  kind: "payment" | "concession"; id: number; amount: number; on: string; receipt_no: number | null; mode: string; reference: string;
  note: string; by: string; reversed_at: Date | null; reversal_reason: string; reversed_by: string | null;
};
export type Totals = { billed: number; paid: number; concession: number; outstanding: number; overdue: number; nextDue: string | null };

// Credits (payments and concessions still standing) pay off installments oldest first.
// Installments must be sorted by due date. Fills in covered and state on each one.
function applyCredits(inst: Pick<Installment, "due_on" | "amount" | "covered" | "state">[], credit: number, today: string) {
  let billed = 0, overdue = 0, nextDue: string | null = null;
  for (const i of inst) {
    billed += i.amount;
    i.covered = Math.min(i.amount, credit);
    credit -= i.covered;
    const left = i.amount - i.covered;
    if (left === 0) i.state = "Paid";
    else if (i.due_on < today) { i.state = "Overdue"; overdue += left; }
    else { i.state = i.covered ? "Part paid" : "Due"; nextDue ??= i.due_on; }
  }
  return { billed, overdue, nextDue };
}

export async function getLedger(studentId: number) {
  const today = todayIST();
  const [plans, inst, pays, cons] = await Promise.all([
    sql`select id, title, created_at, cancelled_at, cancel_reason from fee_plans where student_id = ${studentId} order by created_at`,
    sql<Installment[]>`select i.id, i.plan_id, i.due_on::text, i.amount from fee_installments i join fee_plans p on p.id = i.plan_id
      where p.student_id = ${studentId} order by i.due_on, i.id`,
    sql`select p.id, p.amount, p.paid_on::text as on, p.receipt_no, p.mode, p.reference, p.note, u.name as by,
      p.reversed_at, p.reversal_reason, r.name as reversed_by
      from fee_payments p join users u on u.id = p.created_by left join users r on r.id = p.reversed_by
      where p.student_id = ${studentId}`,
    sql`select c.id, c.amount, (c.created_at at time zone 'Asia/Kolkata')::date::text as on, c.reason as note, u.name as by,
      c.reversed_at, c.reversal_reason, r.name as reversed_by
      from fee_concessions c join users u on u.id = c.created_by left join users r on r.id = c.reversed_by
      where c.student_id = ${studentId}`,
  ]);
  const entries: Entry[] = [
    ...pays.map((p) => ({ kind: "payment" as const, ...p } as Entry)),
    ...cons.map((c) => ({ kind: "concession" as const, receipt_no: null, mode: "", reference: "", ...c } as Entry)),
  ].sort((a, b) => (a.on === b.on ? a.id - b.id : a.on < b.on ? -1 : 1));
  const standing = (e: Entry) => !e.reversed_at;
  const paid = entries.filter((e) => standing(e) && e.kind === "payment").reduce((a, e) => a + e.amount, 0);
  const concession = entries.filter((e) => standing(e) && e.kind === "concession").reduce((a, e) => a + e.amount, 0);

  const live = new Set(plans.filter((p) => !p.cancelled_at).map((p) => p.id as number));
  for (const i of inst) if (!live.has(i.plan_id)) Object.assign(i, { covered: 0, state: "Due" });
  const { billed, overdue, nextDue } = applyCredits(inst.filter((i) => live.has(i.plan_id)), paid + concession, today);
  const totals: Totals = { billed, paid, concession, outstanding: billed - paid - concession, overdue, nextDue };
  const planList: Plan[] = plans.map((p) => ({ ...(p as Omit<Plan, "installments">), installments: inst.filter((i) => i.plan_id === p.id) }));
  return { plans: planList, entries, totals };
}

export type FeeRow = { id: number; name: string; batch: string; paid: number; concession: number; inst: { due_on: string; amount: number }[] };

// One row per active student, with totals worked out the same way as getLedger.
export async function feeSummary(batchId: number | null) {
  const today = todayIST();
  const rows = await sql<FeeRow[]>`
    select u.id, u.name, b.name as batch,
      coalesce((select json_agg(json_build_object('due_on', fi.due_on, 'amount', fi.amount) order by fi.due_on, fi.id)
        from fee_installments fi join fee_plans fp on fp.id = fi.plan_id and fp.cancelled_at is null
        where fp.student_id = u.id), '[]') as inst,
      coalesce((select sum(amount) from fee_payments where student_id = u.id and reversed_at is null), 0)::int as paid,
      coalesce((select sum(amount) from fee_concessions where student_id = u.id and reversed_at is null), 0)::int as concession
    from students st join users u on u.id = st.user_id and u.active join batches b on b.id = st.batch_id
    ${batchId ? sql`where st.batch_id = ${batchId}` : sql``}
    order by b.sort, u.name`;
  return rows.map(({ inst, ...r }) => {
    const credit = r.paid + r.concession;
    const t = applyCredits(inst.map((i) => ({ ...i, covered: 0, state: "Due" as const })), credit, today);
    return { ...r, billed: t.billed, outstanding: t.billed - credit, overdue: t.overdue, next_due: t.nextDue };
  });
}
