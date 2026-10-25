import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole, TEACHING } from "@/lib/auth";
import { sql } from "@/lib/db";
import { canTeach } from "@/lib/queries";
import { fmtDate } from "@/lib/util";
import { Shell } from "@/components/Shell";
import { Flash } from "@/components/Flash";
import { deleteExam, updateExam } from "../../actions";

export default async function ExamPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string>> }) {
  const s = await requireRole(...TEACHING);
  const sp = await searchParams;
  const [e] = await sql`
    select ex.*, ex.held_on::text as date, ex.max_marks::float as max, b.name as batch, sub.name as subject
    from exams ex join batches b on b.id = ex.batch_id join subjects sub on sub.id = ex.subject_id
    where ex.id = ${Number((await params).id) || 0}`;
  if (!e) notFound();
  const editable = await canTeach(s, e.subject_id);
  const rows = await sql`
    select m.student_id, m.marks::float, u.name from exam_marks m join users u on u.id = m.student_id
    where m.exam_id = ${e.id} order by u.name`;
  return (
    <Shell s={s} active="/teach/exams">
      <div><Link href="/teach/exams" className="btn small">← Tests</Link></div>
      <div><h1>{e.subject}: {e.title}</h1><p className="muted">{e.batch} · {fmtDate(e.date)} · out of {e.max}</p></div>
      <Flash sp={sp} />
      <form action={updateExam}>
        <input type="hidden" name="id" value={e.id} />
        <fieldset disabled={!editable} className="panel form" style={{ margin: 0 }}>
          <label>Test name<input id="title" name="title" defaultValue={e.title} /></label>
          <label>Topics<input id="topic" name="topic" defaultValue={e.topic} /></label>
          <div className="full checks">
            {rows.map((r) => (
              <label key={r.student_id} style={{ justifyContent: "space-between" }}>
                {r.name}
                <input id={`m_${r.student_id}`} name={`m_${r.student_id}`} type="number" min="0" max={e.max} step="any" defaultValue={r.marks ?? ""} style={{ width: 80 }} aria-label={`Marks for ${r.name}`} />
              </label>
            ))}
          </div>
          <p className="muted small full">Empty means absent for the test.</p>
          {editable && <div><button className="btn-p" type="submit">Save marks</button></div>}
        </fieldset>
      </form>
      {editable && (
        <form action={deleteExam}>
          <input type="hidden" name="id" value={e.id} />
          <details>
            <summary className="muted small">Delete this test</summary>
            <button className="btn-danger" type="submit">Yes, delete this test and its marks</button>
          </details>
        </form>
      )}
    </Shell>
  );
}
