import Link from "next/link";
import { requireRole, TEACHING } from "@/lib/auth";
import { sql } from "@/lib/db";
import { batchStudents, getBatches, teachableSubjects } from "@/lib/queries";
import { fmtDate } from "@/lib/util";
import { Shell } from "@/components/Shell";
import { Flash } from "@/components/Flash";
import { BatchChips } from "@/components/BatchChips";

export default async function TeachPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const s = await requireRole(...TEACHING);
  const sp = await searchParams;
  const batch = Number(sp.batch) || null;
  const [batches, subjects] = await Promise.all([getBatches(), teachableSubjects(s)]);
  const subjectIds = subjects.map((x) => x.id);
  const lectures = await sql`
    select l.id, l.held_on::text, l.topic, l.homework, b.name as batch, sub.name as subject,
      count(a.*) filter (where a.present)::int as present, count(a.*)::int as total,
      count(a.*) filter (where a.homework_done)::int as hw_done
    from lectures l join batches b on b.id = l.batch_id join subjects sub on sub.id = l.subject_id
    left join attendance a on a.lecture_id = l.id
    where l.subject_id = any(${subjectIds}) ${batch ? sql`and l.batch_id = ${batch}` : sql``}
    group by l.id, b.name, sub.name order by l.held_on desc, l.id desc limit 60`;
  const students = batch ? await batchStudents(batch) : [];
  return (
    <Shell s={s} active="/teach">
      <div className="row-actions" style={{ justifyContent: "space-between" }}>
        <div>
          <h1>Classes</h1>
          <p className="muted">You teach {subjects.map((x) => x.name).join(", ") || "no subjects yet"}.</p>
        </div>
        <Link className="btn btn-p" href={`/teach/new${batch ? `?batch=${batch}` : ""}`}>Log a class</Link>
      </div>
      <Flash sp={sp} />
      <BatchChips batches={batches} current={batch} base="/teach" all />
      <div className="panel tbl-wrap">
        {lectures.length ? (
          <table>
            <thead>
              <tr><th>Date</th><th>Batch</th><th>Subject</th><th>Topic</th><th>Present</th><th>Homework done</th><th></th></tr>
            </thead>
            <tbody>
              {lectures.map((l) => (
                <tr key={l.id}>
                  <td>{fmtDate(l.held_on)}</td>
                  <td>{l.batch}</td>
                  <td>{l.subject}</td>
                  <td>{l.topic}</td>
                  <td className="num">{l.present}/{l.total}</td>
                  <td className="num">{l.homework ? `${l.hw_done}/${l.total}` : "–"}</td>
                  <td><Link href={`/teach/lectures/${l.id}`}>Open</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="muted">No classes logged yet. Use “Log a class” after each lecture.</p>
        )}
      </div>
      {batch && (
        <div className="panel">
          <h2>Students in this batch</h2>
          {students.length ? (
            <div className="chips">
              {students.map((st) => <Link key={st.id} href={`/students/${st.id}`}>{st.name}</Link>)}
            </div>
          ) : (
            <p className="muted">No students in this batch yet.</p>
          )}
        </div>
      )}
    </Shell>
  );
}
