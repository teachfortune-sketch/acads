import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { sql } from "@/lib/db";
import { getBatches, getSubjects } from "@/lib/queries";
import { level, pct } from "@/lib/util";
import { Shell } from "@/components/Shell";
import { BatchChips } from "@/components/BatchChips";

type Row = { id: number; name: string; batch: string; subject_id: number; classes: number; present: number; hw_total: number; hw_done: number; score_sum: number; tests: number };

export default async function AdminPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const s = await requireRole("admin");
  const batch = Number((await searchParams).batch) || null;
  const [batches, subjects] = await Promise.all([getBatches(), getSubjects()]);
  // One row per student per subject.
  const rows = await sql<Row[]>`
    select u.id, u.name, b.name as batch, sub.id as subject_id,
      coalesce(a.classes, 0)::int as classes, coalesce(a.present, 0)::int as present,
      coalesce(a.hw_total, 0)::int as hw_total, coalesce(a.hw_done, 0)::int as hw_done,
      coalesce(e.score_sum, 0)::float as score_sum, coalesce(e.tests, 0)::int as tests
    from students st join users u on u.id = st.user_id and u.active join batches b on b.id = st.batch_id
    cross join subjects sub
    left join lateral (
      select count(*) as classes, count(*) filter (where at.present) as present,
        count(*) filter (where l.homework <> '') as hw_total, count(*) filter (where l.homework <> '' and at.homework_done) as hw_done
      from attendance at join lectures l on l.id = at.lecture_id where at.student_id = u.id and l.subject_id = sub.id
    ) a on true
    left join lateral (
      select sum(m.marks / ex.max_marks) as score_sum, count(*) as tests
      from exam_marks m join exams ex on ex.id = m.exam_id
      where m.student_id = u.id and ex.subject_id = sub.id and m.marks is not null
    ) e on true
    ${batch ? sql`where st.batch_id = ${batch}` : sql``}
    order by b.sort, u.name, sub.sort`;
  const students = new Map<number, { id: number; name: string; batch: string; subj: Map<number, Row> }>();
  for (const r of rows) {
    if (!students.has(r.id)) students.set(r.id, { id: r.id, name: r.name, batch: r.batch, subj: new Map() });
    students.get(r.id)!.subj.set(r.subject_id, r);
  }
  const list = [...students.values()].map((st) => {
    const all = [...st.subj.values()];
    const sum = (k: keyof Row) => all.reduce((a, r) => a + (r[k] as number), 0);
    return {
      ...st,
      att: sum("classes") ? sum("present") / sum("classes") : null,
      hw: sum("hw_total") ? sum("hw_done") / sum("hw_total") : null,
      score: sum("tests") ? sum("score_sum") / sum("tests") : null,
    };
  });
  const flagged = list.filter((x) => (x.att != null && x.att < 0.8) || (x.score != null && x.score < 0.6));
  return (
    <Shell s={s} active="/admin">
      <div className="row-actions" style={{ justifyContent: "space-between" }}>
        <div><h1>Students</h1><p className="muted">{list.length} active students. Click a name for the full profile.</p></div>
        <Link href="/admin/people" className="btn btn-p">Add a student</Link>
      </div>
      <BatchChips batches={batches} current={batch} base="/admin" all />
      {flagged.length > 0 && (
        <div className="banner">
          <b>Needs attention:</b> {flagged.map((x) => x.name).join(", ")} (attendance under 80% or test average under 60%).
        </div>
      )}
      <div className="panel tbl-wrap">
        {list.length ? (
          <table>
            <thead>
              <tr><th>Student</th><th>Attendance</th><th>Homework</th><th>Test avg</th>{subjects.map((x) => <th key={x.id}>{x.name}</th>)}</tr>
            </thead>
            <tbody>
              {list.map((st) => (
                <tr key={st.id}>
                  <td><Link href={`/students/${st.id}`}><b>{st.name}</b></Link><div className="muted small">{st.batch}</div></td>
                  <td className="num">{pct(st.att)}</td>
                  <td className="num">{pct(st.hw)}</td>
                  <td className="num">{pct(st.score)}</td>
                  {subjects.map((x) => {
                    const r = st.subj.get(x.id)!;
                    const [l, c] = level(r.tests ? r.score_sum / r.tests : null);
                    return <td key={x.id}><span className={`chip ${c}`}>{l}</span></td>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="muted">No students yet. Add your first student under Logins.</p>
        )}
      </div>
    </Shell>
  );
}
