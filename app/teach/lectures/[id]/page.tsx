import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole, TEACHING } from "@/lib/auth";
import { sql } from "@/lib/db";
import { canTeach } from "@/lib/queries";
import { Shell } from "@/components/Shell";
import { Flash } from "@/components/Flash";
import { deleteLecture, updateLecture } from "../../actions";

export default async function LecturePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string>> }) {
  const s = await requireRole(...TEACHING);
  const sp = await searchParams;
  const [l] = await sql`
    select l.*, l.held_on::text as date, b.name as batch, sub.name as subject, t.name as teacher
    from lectures l join batches b on b.id = l.batch_id join subjects sub on sub.id = l.subject_id join users t on t.id = l.teacher_id
    where l.id = ${Number((await params).id) || 0}`;
  if (!l) notFound();
  const editable = await canTeach(s, l.subject_id);
  const rows = await sql`
    select a.student_id, a.present, a.homework_done, u.name from attendance a join users u on u.id = a.student_id
    where a.lecture_id = ${l.id} order by u.name`;
  return (
    <Shell s={s} active="/teach">
      <div><Link href="/teach" className="btn small">← Classes</Link></div>
      <div>
        <h1>{l.subject}: {l.topic}</h1>
        <p className="muted">{l.batch} · taught by {l.teacher}</p>
      </div>
      <Flash sp={sp} />
      <form action={updateLecture} className="stack">
        <input type="hidden" name="id" value={l.id} />
        <fieldset disabled={!editable} style={{ border: 0, padding: 0, margin: 0 }} className="stack">
          <div className="panel form">
            <label>Date<input id="held_on" name="held_on" type="date" defaultValue={l.date} required /></label>
            <label className="full">Topic<input id="topic" name="topic" defaultValue={l.topic} required /></label>
            <label className="full">Class notes<textarea id="notes" name="notes" defaultValue={l.notes} /></label>
            <label className="full">Homework<input id="homework" name="homework" defaultValue={l.homework} /></label>
          </div>
          <div className="panel tbl-wrap">
            <h2>Attendance and homework</h2>
            <p className="muted small">Tick “Homework done” when the student shows you their homework.</p>
            <table>
              <thead><tr><th>Student</th><th>Present</th><th>Homework done</th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.student_id}>
                    <td>{r.name}</td>
                    <td><input type="checkbox" id={`p_${r.student_id}`} name={`p_${r.student_id}`} defaultChecked={r.present} aria-label={`${r.name} present`} /></td>
                    <td><input type="checkbox" id={`h_${r.student_id}`} name={`h_${r.student_id}`} defaultChecked={r.homework_done} aria-label={`${r.name} homework done`} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {editable && <div><button className="btn-p" type="submit">Save changes</button></div>}
        </fieldset>
      </form>
      {editable && (
        <form action={deleteLecture}>
          <input type="hidden" name="id" value={l.id} />
          <details>
            <summary className="muted small">Delete this class</summary>
            <p className="small">This removes the class and its attendance for every student.</p>
            <button className="btn-danger" type="submit">Yes, delete this class</button>
          </details>
        </form>
      )}
    </Shell>
  );
}
