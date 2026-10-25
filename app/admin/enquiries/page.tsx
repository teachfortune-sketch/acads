import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { sql } from "@/lib/db";
import { ENQUIRY_STATUSES, fmtDate } from "@/lib/util";
import { Shell } from "@/components/Shell";
import { Flash } from "@/components/Flash";
import { updateEnquiry } from "../enquiry-actions";

const chip: Record<string, string> = { New: "c-bad", Contacted: "c-warn", "Demo scheduled": "c-info", "Demo attended": "c-info", Admitted: "c-good", Lost: "" };

export default async function EnquiriesPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const s = await requireRole("admin");
  const sp = await searchParams;
  const status = (ENQUIRY_STATUSES as readonly string[]).includes(sp.status ?? "") ? sp.status : null;
  const counts = await sql`select status, count(*)::int as n from enquiries group by status`;
  const n = (st: string) => counts.find((c) => c.status === st)?.n ?? 0;
  const open = ENQUIRY_STATUSES.filter((x) => x !== "Admitted" && x !== "Lost");
  const rows = await sql`
    select id, guardian_name, student_name, class_level, phone, message, source, status, next_follow_up::text, notes, created_at
    from enquiries
    where ${status ? sql`status = ${status}` : sql`status = any(${open as unknown as string[]})`}
    order by (status = 'New') desc, next_follow_up nulls last, created_at desc limit 200`;
  return (
    <Shell s={s} active="/admin/enquiries">
      <div><h1>Enquiries</h1><p className="muted">Admission enquiries from the website. Give every open enquiry a next follow-up date.</p></div>
      <Flash sp={sp} />
      <div className="chips">
        <Link href="/admin/enquiries" aria-current={!status}>Open ({open.reduce((a, x) => a + n(x), 0)})</Link>
        {ENQUIRY_STATUSES.map((x) => (
          <Link key={x} href={`/admin/enquiries?status=${encodeURIComponent(x)}`} aria-current={status === x}>{x} ({n(x)})</Link>
        ))}
      </div>
      {rows.length ? (
        <div className="stack">
          {rows.map((e) => (
            <form key={e.id} action={updateEnquiry} className="panel form">
              <input type="hidden" name="id" value={e.id} />
              <input type="hidden" name="filter" value={status ?? ""} />
              <div className="full row-actions" style={{ justifyContent: "space-between" }}>
                <div>
                  <b>{e.guardian_name}</b>{e.student_name ? ` for ${e.student_name}` : ""}{e.class_level ? ` · ${e.class_level}` : ""}
                  <div className="muted small">
                    <span className="num">{e.phone}</span> · {fmtDate(e.created_at)} · from {e.source}
                  </div>
                  {e.message && <div className="small pre">{e.message}</div>}
                </div>
                <span className={`chip ${chip[e.status] ?? ""}`}>{e.status}</span>
              </div>
              <label>Status
                <select id={`status_${e.id}`} name="status" defaultValue={e.status}>{ENQUIRY_STATUSES.map((x) => <option key={x}>{x}</option>)}</select>
              </label>
              <label>Next follow-up<input id={`next_${e.id}`} name="next_follow_up" type="date" defaultValue={e.next_follow_up ?? ""} /></label>
              <label className="full">Notes (reason if lost)<input id={`notes_${e.id}`} name="notes" defaultValue={e.notes} /></label>
              <div><button className="btn-p small" type="submit">Save</button></div>
            </form>
          ))}
        </div>
      ) : (
        <div className="panel"><p className="muted">No enquiries here yet. The form on the home page sends them here.</p></div>
      )}
    </Shell>
  );
}
