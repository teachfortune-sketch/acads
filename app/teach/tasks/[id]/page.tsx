import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole, TEACHING } from "@/lib/auth";
import { sql } from "@/lib/db";
import { canTeach } from "@/lib/queries";
import { fmtDate } from "@/lib/util";
import { Shell } from "@/components/Shell";
import { Flash } from "@/components/Flash";
import { deleteTask, updateTaskStatus } from "../../task-actions";

export default async function TaskPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string>> }) {
  const s = await requireRole(...TEACHING);
  const sp = await searchParams;
  const [t] = await sql`
    select t.*, t.due_on::text as due, b.name as batch, sub.name as subject, u.name as teacher, l.topic as lecture_topic, l.held_on::text as lecture_date
    from tasks t join batches b on b.id = t.batch_id join subjects sub on sub.id = t.subject_id join users u on u.id = t.teacher_id
    left join lectures l on l.id = t.lecture_id
    where t.id = ${Number((await params).id) || 0}`;
  if (!t) notFound();
  const editable = await canTeach(s, t.subject_id);
  const rows = await sql`select ts.student_id, ts.done, u.name from task_students ts join users u on u.id = ts.student_id where ts.task_id = ${t.id} order by u.name`;
  return (
    <Shell s={s} active="/teach/tasks">
      <div><Link href={`/teach/tasks?batch=${t.batch_id}`} className="btn small">← Tasks</Link></div>
      <div>
        <h1>{t.title}</h1>
        <p className="muted">
          {t.batch} · {t.subject} · by {t.teacher}{t.due ? ` · due ${fmtDate(t.due)}` : ""}
          {t.lecture_topic && <> · for the class on {fmtDate(t.lecture_date)}: {t.lecture_topic}</>}
        </p>
        {t.details && <p className="pre">{t.details}</p>}
      </div>
      <Flash sp={sp} />
      <form action={updateTaskStatus} className="panel tbl-wrap">
        <input type="hidden" name="id" value={t.id} />
        <table>
          <thead><tr><th>Student</th><th>Done</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.student_id}>
                <td>{r.name}</td>
                <td><input type="checkbox" id={`d_${r.student_id}`} name={`d_${r.student_id}`} defaultChecked={r.done} disabled={!editable} aria-label={`${r.name} done`} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        {editable && <div style={{ marginTop: 10 }}><button className="btn-p" type="submit">Save</button></div>}
      </form>
      {editable && (
        <form action={deleteTask}>
          <input type="hidden" name="id" value={t.id} />
          <details><summary className="muted small">Delete this task</summary><button className="btn-danger" type="submit">Yes, delete it</button></details>
        </form>
      )}
    </Shell>
  );
}
