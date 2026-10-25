import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { sql } from "@/lib/db";
import { feeSummary } from "@/lib/fees";
import { getBatches } from "@/lib/queries";
import { fmtDate, rupees } from "@/lib/util";
import { Shell } from "@/components/Shell";
import { BatchChips } from "@/components/BatchChips";
import { Flash } from "@/components/Flash";

export default async function FeesPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const s = await requireRole("admin");
  const sp = await searchParams;
  const batch = Number(sp.batch) || null;
  const [batches, rows, recent] = await Promise.all([
    getBatches(),
    feeSummary(batch),
    sql`select p.id, p.receipt_no, p.amount, p.paid_on::text, p.mode, p.reversed_at, u.name
      from fee_payments p join users u on u.id = p.student_id order by p.receipt_no desc limit 10`,
  ]);
  const sum = (k: "billed" | "paid" | "outstanding" | "overdue") => rows.reduce((a, r) => a + Math.max(0, r[k]), 0);
  const list = [...rows].sort((a, b) => b.overdue - a.overdue || b.outstanding - a.outstanding);
  const noPlan = rows.filter((r) => !r.billed).length;
  return (
    <Shell s={s} active="/admin/fees">
      <div><h1>Fees</h1><p className="muted">Fee plans, payments received and what is still due. Click a student to record a payment.</p></div>
      <Flash sp={sp} />
      <BatchChips batches={batches} current={batch} base="/admin/fees" all />
      <div className="grid fee-tiles">
        <div className="panel"><div className="muted small">Total fees</div><div className="big num">{rupees(sum("billed"))}</div></div>
        <div className="panel"><div className="muted small">Received</div><div className="big num">{rupees(sum("paid"))}</div></div>
        <div className="panel"><div className="muted small">Outstanding</div><div className="big num">{rupees(sum("outstanding"))}</div></div>
        <div className="panel"><div className="muted small">Overdue now</div><div className="big num" style={{ color: sum("overdue") ? "var(--bad)" : undefined }}>{rupees(sum("overdue"))}</div></div>
      </div>
      {noPlan > 0 && <div className="banner">{noPlan} student{noPlan > 1 ? "s have" : " has"} no fee plan yet.</div>}
      <div className="panel tbl-wrap">
        {list.length ? (
          <table>
            <thead><tr><th>Student</th><th>Total fee</th><th>Received</th><th>Outstanding</th><th>Overdue</th><th>Next due</th></tr></thead>
            <tbody>
              {list.map((r) => (
                <tr key={r.id}>
                  <td><Link href={`/admin/fees/${r.id}`}><b>{r.name}</b></Link><div className="muted small">{r.batch}</div></td>
                  <td className="num">{r.billed ? rupees(r.billed) : <span className="chip c-warn">No plan</span>}</td>
                  <td className="num">{rupees(r.paid)}</td>
                  <td className="num">{r.outstanding < 0 ? `${rupees(-r.outstanding)} advance` : rupees(r.outstanding)}</td>
                  <td className="num">{r.overdue ? <span className="chip c-bad">{rupees(r.overdue)}</span> : "–"}</td>
                  <td>{r.outstanding > 0 && r.next_due ? fmtDate(r.next_due) : "–"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="muted">No students yet.</p>
        )}
      </div>
      <div className="panel">
        <h2>Latest receipts</h2>
        {recent.length ? (
          <ul className="list">
            {recent.map((p) => (
              <li key={p.id}>
                <div><Link href={`/fees/receipt/${p.id}`}><b>#{p.receipt_no}</b></Link> · {p.name}
                  <div className="muted small">{fmtDate(p.paid_on)} · {p.mode}{p.reversed_at ? " · reversed" : ""}</div></div>
                <span className="num" style={{ textDecoration: p.reversed_at ? "line-through" : undefined }}>{rupees(p.amount)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">No payments recorded yet.</p>
        )}
      </div>
    </Shell>
  );
}
