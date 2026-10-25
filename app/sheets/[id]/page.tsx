import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { sql } from "@/lib/db";
import { fmtDate } from "@/lib/util";
import { Shell } from "@/components/Shell";
import { Flash } from "@/components/Flash";
import { deleteSheet, updateSheetStatus } from "@/app/teach/sheet-actions";
import { toggleSheet } from "@/app/me/actions";

export default async function SheetPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string>> }) {
  const s = await requireRole();
  const sp = await searchParams;
  const [sh] = await sql`
    select sh.*, sh.due_on::text as due, b.name as batch, sub.name as subject
    from sheets sh join batches b on b.id = sh.batch_id left join subjects sub on sub.id = sh.subject_id
    where sh.id = ${Number((await params).id) || 0}`;
  if (!sh) notFound();
  const teaching = s.role === "admin" || s.role === "teacher";
  // Students see their own sheets; parents see their children's.
  const [mine] = s.role === "student"
    ? await sql`select done from sheet_students where sheet_id = ${sh.id} and student_id = ${s.uid}`
    : s.role === "parent"
      ? await sql`select ss.done from sheet_students ss join students st on st.user_id = ss.student_id where ss.sheet_id = ${sh.id} and st.parent_id = ${s.uid} limit 1`
      : [];
  if (!teaching && !mine) redirect("/");
  const rows = teaching
    ? await sql`select ss.student_id, ss.done, u.name from sheet_students ss join users u on u.id = ss.student_id where ss.sheet_id = ${sh.id} order by u.name`
    : [];
  const home = teaching ? "/teach/sheets" : s.role === "parent" ? "/parent" : "/me";
  return (
    <Shell s={s} active={home}>
      <div><Link href={home} className="btn small">← Back</Link></div>
      <div>
        <h1>Sheet {sh.number}: {sh.title}</h1>
        <p className="muted">{sh.batch}{sh.subject ? ` · ${sh.subject}` : ""}{sh.due ? ` · due ${fmtDate(sh.due)}` : ""}</p>
      </div>
      <Flash sp={sp} />
      {s.role === "student" && (
        <form action={toggleSheet}>
          <input type="hidden" name="id" value={sh.id} />
          <button className={mine.done ? "" : "btn-p"} type="submit">{mine.done ? "✓ Done (tap to undo)" : "Mark as done"}</button>
        </form>
      )}
      {s.role === "parent" && <p><span className={`chip ${mine.done ? "c-good" : "c-warn"}`}>{mine.done ? "Done" : "Not done yet"}</span></p>}
      <div className="panel"><div className="pre sheet-body">{sh.body || "No questions written yet."}</div></div>
      {teaching && (
        <form action={updateSheetStatus} className="panel tbl-wrap">
          <input type="hidden" name="id" value={sh.id} />
          <h2>Who has finished</h2>
          <table>
            <thead><tr><th>Student</th><th>Done</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.student_id}><td>{r.name}</td><td><input type="checkbox" id={`d_${r.student_id}`} name={`d_${r.student_id}`} defaultChecked={r.done} aria-label={`${r.name} done`} /></td></tr>
              ))}
            </tbody>
          </table>
          <div style={{ marginTop: 10 }}><button className="btn-p" type="submit">Save</button></div>
        </form>
      )}
      {s.role === "admin" && (
        <form action={deleteSheet}>
          <input type="hidden" name="id" value={sh.id} />
          <details><summary className="muted small">Delete this sheet</summary><button className="btn-danger" type="submit">Yes, delete it</button></details>
        </form>
      )}
    </Shell>
  );
}
