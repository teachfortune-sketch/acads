import Link from "next/link";
import { requireRole, TEACHING } from "@/lib/auth";
import { sql } from "@/lib/db";
import { getBatches, getSubjects } from "@/lib/queries";
import { fmtDate } from "@/lib/util";
import { Shell } from "@/components/Shell";
import { Flash } from "@/components/Flash";
import { BatchChips } from "@/components/BatchChips";
import { createSheet } from "../sheet-actions";

export default async function SheetsPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const s = await requireRole(...TEACHING);
  const sp = await searchParams;
  const batch = Number(sp.batch) || null;
  const [batches, subjects] = await Promise.all([getBatches(), getSubjects()]);
  const sheets = await sql`
    select sh.id, sh.number, sh.title, sh.due_on::text, b.name as batch, sub.name as subject,
      count(ss.*)::int as total, count(ss.*) filter (where ss.done)::int as done
    from sheets sh join batches b on b.id = sh.batch_id left join subjects sub on sub.id = sh.subject_id
    left join sheet_students ss on ss.sheet_id = sh.id
    ${batch ? sql`where sh.batch_id = ${batch}` : sql``}
    group by sh.id, b.name, sub.name order by sh.number desc`;
  const [{ next }] = await sql`select coalesce(max(number), 0) + 1 as next from sheets`;
  return (
    <Shell s={s} active="/teach/sheets">
      <div><h1>Worksheets</h1><p className="muted">Each numbered sheet is given to every student in its batch. Sheets made with Claude in chat appear here after the next update.</p></div>
      <Flash sp={sp} />
      <BatchChips batches={batches} current={batch} base="/teach/sheets" all />
      <div className="panel tbl-wrap">
        {sheets.length ? (
          <table>
            <thead><tr><th>No.</th><th>Sheet</th><th>Batch</th><th>Subject</th><th>Due</th><th>Done</th></tr></thead>
            <tbody>
              {sheets.map((sh) => (
                <tr key={sh.id}>
                  <td className="num">{sh.number}</td>
                  <td><Link href={`/sheets/${sh.id}`}>{sh.title}</Link></td>
                  <td>{sh.batch}</td><td>{sh.subject ?? "–"}</td><td>{sh.due_on ? fmtDate(sh.due_on) : "–"}</td>
                  <td className="num">{sh.done}/{sh.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <p className="muted">No sheets yet.</p>}
      </div>
      {s.role === "admin" && (
        <details className="panel">
          <summary><h2 style={{ display: "inline" }}>Add a sheet here</h2></summary>
          <form action={createSheet} className="form" style={{ marginTop: 12 }}>
            <label>Sheet number<input id="number" name="number" type="number" min="1" defaultValue={next} required /></label>
            <label>Batch<select id="sh_batch" name="batch_id" required>{batches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></label>
            <label>Subject<select id="sh_subject" name="subject_id"><option value="">Any</option>{subjects.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
            <label>Due date<input id="sh_due" name="due_on" type="date" /></label>
            <label className="full">Title<input id="sh_title" name="title" required placeholder="e.g. Fractions practice" /></label>
            <label className="full">Questions<textarea id="sh_body" name="body" style={{ minHeight: 180 }} /></label>
            <div><button className="btn-p" type="submit">Create and assign</button></div>
          </form>
        </details>
      )}
    </Shell>
  );
}
