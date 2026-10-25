import Link from "next/link";
import { requireRole, TEACHING } from "@/lib/auth";
import { sql } from "@/lib/db";
import { batchStudents, getBatches, teachableSubjects } from "@/lib/queries";
import { fmtDate } from "@/lib/util";
import { Shell } from "@/components/Shell";
import { Flash } from "@/components/Flash";
import { BatchChips } from "@/components/BatchChips";
import { createTask } from "../task-actions";

export default async function TasksPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const s = await requireRole(...TEACHING);
  const sp = await searchParams;
  const [batches, subjects] = await Promise.all([getBatches(), teachableSubjects(s)]);
  const batch = batches.find((b) => b.id === Number(sp.batch));
  const students = batch ? await batchStudents(batch.id) : [];
  const lectures = batch
    ? await sql`select l.id, l.subject_id, l.topic, l.held_on::text, sub.name as subject from lectures l join subjects sub on sub.id = l.subject_id
        where l.batch_id = ${batch.id} and l.subject_id = any(${subjects.map((x) => x.id)}) order by l.held_on desc, l.id desc limit 15`
    : [];
  const fromLecture = lectures.find((l) => l.id === Number(sp.lecture));
  const tasks = await sql`
    select t.id, t.title, t.due_on::text, b.name as batch, sub.name as subject,
      count(ts.*)::int as total, count(ts.*) filter (where ts.done)::int as done
    from tasks t join batches b on b.id = t.batch_id join subjects sub on sub.id = t.subject_id
    left join task_students ts on ts.task_id = t.id
    where t.subject_id = any(${subjects.map((x) => x.id)}) ${batch ? sql`and t.batch_id = ${batch.id}` : sql``}
    group by t.id, b.name, sub.name order by t.created_at desc limit 50`;
  return (
    <Shell s={s} active="/teach/tasks">
      <div><h1>Tasks</h1><p className="muted">Give students work to improve after a class. They see it on their page and tick it off when done.</p></div>
      <Flash sp={sp} />
      <div className="panel stack">
        <b className="small">Choose the batch</b>
        <BatchChips batches={batches} current={batch?.id ?? null} base="/teach/tasks" />
        {batch && (
          <form action={createTask} className="form">
            <input type="hidden" name="batch_id" value={batch.id} />
            <label>Subject
              <select id="subject_id" name="subject_id" defaultValue={fromLecture?.subject_id} required>{subjects.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select>
            </label>
            <label>For the class
              <select id="lecture_id" name="lecture_id" defaultValue={fromLecture?.id ?? ""}>
                <option value="">Not linked to a class</option>
                {lectures.map((l) => <option key={l.id} value={l.id}>{fmtDate(l.held_on)} · {l.subject}: {l.topic}</option>)}
              </select>
            </label>
            <label>Due date<input id="due_on" name="due_on" type="date" /></label>
            <label className="full">Task<input id="title" name="title" required placeholder="e.g. Redo the 5 sums you got wrong in today's class" /></label>
            <label className="full">Details (optional)<textarea id="details" name="details" placeholder="Steps, page numbers, what to show me next class" /></label>
            <div className="full">
              <b className="small">Students</b> <span className="muted small">(untick anyone who doesn't need this)</span>
              <div className="checks" style={{ marginTop: 6 }}>
                {students.map((st) => <label key={st.id}><input type="checkbox" id={`s_${st.id}`} name={`s_${st.id}`} defaultChecked />{st.name}</label>)}
              </div>
            </div>
            <div><button className="btn-p" type="submit">Give task</button></div>
          </form>
        )}
      </div>
      <div className="panel tbl-wrap">
        <h2>Tasks given</h2>
        {tasks.length ? (
          <table>
            <thead><tr><th>Task</th><th>Batch</th><th>Subject</th><th>Due</th><th>Done</th><th></th></tr></thead>
            <tbody>
              {tasks.map((t) => (
                <tr key={t.id}>
                  <td>{t.title}</td><td>{t.batch}</td><td>{t.subject}</td><td>{t.due_on ? fmtDate(t.due_on) : "–"}</td>
                  <td className="num">{t.done}/{t.total}</td><td><Link href={`/teach/tasks/${t.id}`}>Open</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <p className="muted">No tasks yet.</p>}
      </div>
    </Shell>
  );
}
