import Link from "next/link";
import { notFound } from "next/navigation";
import { randomUUID } from "crypto";
import { requireRole } from "@/lib/auth";
import { getLedger } from "@/lib/fees";
import { getStudent } from "@/lib/queries";
import { PAY_MODES, todayIST } from "@/lib/util";
import { Shell } from "@/components/Shell";
import { Flash } from "@/components/Flash";
import { Entries, FeeTotals, Schedule } from "@/components/FeeViews";
import { addConcession, cancelPlan, createPlan, recordPayment, reverseConcession, reversePayment } from "../../fee-actions";

export default async function StudentFeesPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string>> }) {
  const s = await requireRole("admin");
  const st = await getStudent(Number((await params).id));
  if (!st) notFound();
  const sp = await searchParams;
  const { plans, entries, totals } = await getLedger(st.id);
  const today = todayIST();
  const hidden = <input type="hidden" name="student_id" value={st.id} />;
  return (
    <Shell s={s} active="/admin/fees">
      <div className="row-actions" style={{ justifyContent: "space-between" }}>
        <div><h1>{st.name}: fees</h1><p className="muted">{st.batch} · <Link href={`/students/${st.id}`}>Profile</Link> · <Link href="/admin/fees">All fees</Link></p></div>
      </div>
      <Flash sp={sp} />
      <FeeTotals t={totals} />

      <div className="grid">
        <form action={recordPayment} className="panel form">
          <h2 className="full">Record a payment</h2>
          {hidden}
          <input type="hidden" name="token" value={randomUUID()} />
          <label>Amount (₹)<input name="amount" inputMode="numeric" required placeholder="e.g. 2500" /></label>
          <label>Paid on<input name="paid_on" type="date" defaultValue={today} max={today} required /></label>
          <label>Mode<select name="mode" defaultValue="Cash">{PAY_MODES.map((m) => <option key={m}>{m}</option>)}</select></label>
          <label>Reference (UPI / bank / cheque no.)<input name="reference" /></label>
          <label className="full">Note<input name="note" placeholder="Optional, e.g. October installment" /></label>
          <div><button className="btn-p" type="submit">Save and make receipt</button></div>
        </form>

        <div className="stack">
          <details className="panel" open={!plans.length}>
            <summary><b>Add a fee plan</b></summary>
            <form action={createPlan} className="form" style={{ marginTop: 12 }}>
              {hidden}
              <label className="full">Plan name<input name="title" required placeholder="e.g. Tuition 2026–27" /></label>
              <label>Total fee (₹)<input name="total" inputMode="numeric" required placeholder="e.g. 30000" /></label>
              <label>Installments<select name="count" defaultValue="1">{[1, 2, 3, 4, 6, 10, 12].map((n) => <option key={n} value={n}>{n === 1 ? "One payment" : `${n} parts`}</option>)}</select></label>
              <label>First due on<input name="first_due" type="date" defaultValue={today} required /></label>
              <label>Then every<select name="gap" defaultValue="1">{[[1, "month"], [2, "2 months"], [3, "3 months"], [6, "6 months"], [12, "year"]].map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
              <div><button className="btn-p small" type="submit">Add plan</button></div>
            </form>
          </details>
          <details className="panel">
            <summary><b>Give a concession</b></summary>
            <form action={addConcession} className="form" style={{ marginTop: 12 }}>
              {hidden}
              <label>Amount (₹)<input name="amount" inputMode="numeric" required /></label>
              <label>Reason<input name="reason" required placeholder="e.g. Sibling discount" /></label>
              <div><button className="btn-p small" type="submit">Add concession</button></div>
            </form>
          </details>
        </div>
      </div>

      <h2>Fee schedule</h2>
      <Schedule
        plans={plans}
        cancelForm={(p) => (
          <details className="no-print" style={{ marginTop: 10 }}>
            <summary className="small muted">Cancel this plan</summary>
            <form action={cancelPlan} className="inline-form" style={{ justifyContent: "flex-start" }}>
              {hidden}<input type="hidden" name="plan_id" value={p.id} />
              <input name="reason" required placeholder="Reason" aria-label="Reason for cancelling" />
              <button className="small btn-danger" type="submit">Cancel plan</button>
            </form>
          </details>
        )}
      />
      <Entries
        entries={entries}
        reverseForm={(e) => (
          <details>
            <summary className="small muted">Reverse</summary>
            <form action={e.kind === "payment" ? reversePayment : reverseConcession} className="inline-form">
              {hidden}<input type="hidden" name="id" value={e.id} />
              <input name="reason" required placeholder="Reason" aria-label="Reason for reversing" />
              <button className="small btn-danger" type="submit">Reverse</button>
            </form>
          </details>
        )}
      />
    </Shell>
  );
}
