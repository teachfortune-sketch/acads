import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { sql } from "@/lib/db";
import { getLedger } from "@/lib/fees";
import { fmtDate, rupees } from "@/lib/util";
import { Shell } from "@/components/Shell";
import { Flash } from "@/components/Flash";
import { PrintButton } from "@/components/PrintButton";

export default async function ReceiptPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string>> }) {
  const s = await requireRole("admin", "parent");
  const sp = await searchParams;
  const [r] = await sql`
    select p.*, p.paid_on::text, u.name as student, b.name as batch, st.parent_id, c.name as by, rv.name as reversed_name
    from fee_payments p join users u on u.id = p.student_id join students st on st.user_id = p.student_id
    join batches b on b.id = st.batch_id join users c on c.id = p.created_by left join users rv on rv.id = p.reversed_by
    where p.id = ${Number((await params).id) || 0}`;
  // A parent sees only their own child's receipts; anything else looks like a missing page.
  if (!r || (s.role === "parent" && r.parent_id !== s.uid)) notFound();
  const { totals } = await getLedger(r.student_id);
  const back = s.role === "admin" ? `/admin/fees/${r.student_id}` : `/parent?tab=fees&child=${r.student_id}`;
  return (
    <Shell s={s} active={s.role === "admin" ? "/admin/fees" : "/parent?tab=fees"} child={s.role === "parent" ? r.student_id : undefined}>
      <Flash sp={sp} />
      <div className="row-actions no-print"><Link href={back}>← Back to fees</Link><PrintButton /></div>
      <div className="panel receipt stack">
        <div className="row-actions" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <h2>Acads Coaching Institute</h2>
            <div className="muted small">Saket Nagar, Varanasi</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div className="muted small">Receipt no.</div>
            <div className="big num">#{r.receipt_no}</div>
          </div>
        </div>
        {r.reversed_at && (
          <div className="err">REVERSED on {fmtDate(r.reversed_at)}{r.reversed_name ? ` by ${r.reversed_name}` : ""}: {r.reversal_reason}</div>
        )}
        <table>
          <tbody>
            <tr><th>Student</th><td>{r.student} · {r.batch}</td></tr>
            <tr><th>Amount received</th><td className="num"><b>{rupees(r.amount)}</b></td></tr>
            <tr><th>Date</th><td>{fmtDate(r.paid_on)}</td></tr>
            <tr><th>Mode</th><td>{r.mode}{r.reference ? ` · ref ${r.reference}` : ""}</td></tr>
            {r.note && <tr><th>Note</th><td>{r.note}</td></tr>}
            <tr><th>Received by</th><td>{r.by}</td></tr>
            <tr><th>Balance today</th><td className="num">{totals.outstanding < 0 ? `${rupees(-totals.outstanding)} paid in advance` : rupees(totals.outstanding)}</td></tr>
          </tbody>
        </table>
        <p className="muted small">Computer-made receipt. Please keep it for your records.</p>
      </div>
    </Shell>
  );
}
