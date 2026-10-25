import { requireRole, TEACHING } from "@/lib/auth";
import { sql } from "@/lib/db";
import { batchStudents, getBatches, teachableSubjects } from "@/lib/queries";
import { fmtDate } from "@/lib/util";
import { Shell } from "@/components/Shell";
import { Flash } from "@/components/Flash";
import { BatchChips } from "@/components/BatchChips";
import { createRemark } from "../actions";

export default async function RemarksPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const s = await requireRole(...TEACHING);
  const sp = await searchParams;
  const [batches, subjects] = await Promise.all([getBatches(), teachableSubjects(s)]);
  const batch = batches.find((b) => b.id === Number(sp.batch));
  const students = batch ? await batchStudents(batch.id) : [];
  const recent = await sql`
    select r.id, r.body, r.created_at, u.name as student, sub.name as subject, a.name as author
    from remarks r join users u on u.id = r.student_id left join subjects sub on sub.id = r.subject_id join users a on a.id = r.author_id
    ${s.role === "admin" ? sql`` : sql`where r.author_id = ${s.uid}`}
    order by r.created_at desc limit 30`;
  return (
    <Shell s={s} active="/teach/remarks">
      <div><h1>Remarks</h1><p className="muted">A short note on how a student is doing. The student and their parent see it on their page.</p></div>
      <Flash sp={sp} />
      <div className="panel stack">
        <BatchChips batches={batches} current={batch?.id ?? null} base="/teach/remarks" />
        {batch && (
          <form action={createRemark} className="form">
            <input type="hidden" name="batch_id" value={batch.id} />
            <label>Student
              <select id="student_id" name="student_id" required>
                {students.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
              </select>
            </label>
            <label>Subject
              <select id="subject_id" name="subject_id" required>
                {subjects.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
              </select>
            </label>
            <label className="full">Remark<textarea id="body" name="body" required placeholder="e.g. Good effort in class. Needs to practise long division daily." /></label>
            <div><button className="btn-p" type="submit">Save remark</button></div>
          </form>
        )}
      </div>
      <div className="panel">
        <h2>Recent remarks</h2>
        {recent.length ? (
          <ul className="list">
            {recent.map((r) => (
              <li key={r.id}><div><b>{r.student}</b>{r.subject ? ` · ${r.subject}` : ""}: <span className="pre">{r.body}</span><div className="muted small">{r.author} · {fmtDate(r.created_at)}</div></div></li>
            ))}
          </ul>
        ) : <p className="muted">No remarks yet.</p>}
      </div>
    </Shell>
  );
}
