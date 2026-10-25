import Link from "next/link";
import type { Entry, Plan, Totals } from "@/lib/fees";
import { fmtDate, rupees } from "@/lib/util";

const stateChip = { Paid: "c-good", "Part paid": "c-warn", Overdue: "c-bad", Due: "c-info" } as const;

export function FeeTotals({ t }: { t: Totals }) {
  const advance = t.outstanding < 0;
  return (
    <div className="grid fee-tiles">
      <div className="panel"><div className="muted small">Total fee</div><div className="big num">{rupees(t.billed)}</div></div>
      <div className="panel"><div className="muted small">Received</div><div className="big num">{rupees(t.paid)}</div>
        {t.concession > 0 && <div className="muted small">plus {rupees(t.concession)} concession</div>}</div>
      <div className="panel"><div className="muted small">{advance ? "Paid in advance" : "Outstanding"}</div>
        <div className="big num">{rupees(Math.abs(t.outstanding))}</div>
        {!advance && t.outstanding > 0 && <div className="muted small">{t.nextDue ? `Next due ${fmtDate(t.nextDue)}` : ""}</div>}</div>
      <div className="panel"><div className="muted small">Overdue now</div>
        <div className="big num" style={{ color: t.overdue ? "var(--bad-ink)" : undefined }}>{rupees(t.overdue)}</div></div>
    </div>
  );
}

export function Schedule({ plans, cancelForm }: { plans: Plan[]; cancelForm?: (p: Plan) => React.ReactNode }) {
  if (!plans.length) return <div className="panel"><p className="muted">No fee plan yet.</p></div>;
  return (
    <>
      {plans.map((p) => (
        <div key={p.id} className="panel tbl-wrap">
          <div className="row-actions" style={{ justifyContent: "space-between" }}>
            <h3>{p.title}{p.cancelled_at && <> <span className="chip">Cancelled</span></>}</h3>
            <span className="num">{rupees(p.installments.reduce((a, i) => a + i.amount, 0))}</span>
          </div>
          {p.cancelled_at && <p className="muted small">Cancelled {fmtDate(p.cancelled_at)}: {p.cancel_reason}</p>}
          <table>
            <thead><tr><th>Due on</th><th>Amount</th><th>Paid against it</th><th>Status</th></tr></thead>
            <tbody>
              {p.installments.map((i) => (
                <tr key={i.id} className={p.cancelled_at ? "muted" : ""}>
                  <td>{fmtDate(i.due_on)}</td>
                  <td className="num">{rupees(i.amount)}</td>
                  <td className="num">{p.cancelled_at ? "–" : rupees(i.covered)}</td>
                  <td>{p.cancelled_at ? "–" : <span className={`chip ${stateChip[i.state]}`}>{i.state}</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!p.cancelled_at && cancelForm?.(p)}
        </div>
      ))}
    </>
  );
}

export function Entries({ entries, child, reverseForm }: { entries: Entry[]; child?: number; reverseForm?: (e: Entry) => React.ReactNode }) {
  return (
    <div className="panel">
      <h2>Payments and concessions</h2>
      {entries.length ? (
        <ul className="list">
          {[...entries].reverse().map((e) => (
            <li key={`${e.kind}${e.id}`}>
              <div style={{ textDecoration: e.reversed_at ? "line-through" : undefined }}>
                {e.kind === "payment" ? (
                  <>
                    <Link href={`/fees/receipt/${e.id}${child ? `?child=${child}` : ""}`}><b>Receipt #{e.receipt_no}</b></Link> · {e.mode}
                    {e.reference && <> · ref <span className="num">{e.reference}</span></>}
                  </>
                ) : (
                  <b>Concession</b>
                )}
                <div className="muted small">{fmtDate(e.on)}{e.note ? ` · ${e.note}` : ""}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div className="num" style={{ textDecoration: e.reversed_at ? "line-through" : undefined }}>{rupees(e.amount)}</div>
                {e.reversed_at ? (
                  <div className="small" style={{ color: "var(--bad-ink)" }}>Reversed{e.reversed_by ? ` by ${e.reversed_by}` : ""}: {e.reversal_reason}</div>
                ) : (
                  reverseForm?.(e)
                )}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted">Nothing recorded yet.</p>
      )}
    </div>
  );
}
