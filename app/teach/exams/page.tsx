import Link from "next/link";
import { requireRole, TEACHING } from "@/lib/auth";
import { sql } from "@/lib/db";
import { getBatches, teachableSubjects } from "@/lib/queries";
import { fmtDate, pct } from "@/lib/util";
import { Shell } from "@/components/Shell";
import { Flash } from "@/components/Flash";
import { BatchChips } from "@/components/BatchChips";

export default async function ExamsPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const s = await requireRole(...TEACHING);
  const sp = await searchParams;
  const batch = Number(sp.batch) || null;
  const [batches, subjects] = await Promise.all([getBatches(), teachableSubjects(s)]);
  const exams = await sql`
    select ex.id, ex.title, ex.topic, ex.held_on::text, ex.max_marks::float, b.name as batch, sub.name as subject,
      avg(m.marks / ex.max_marks)::float as avg, count(m.marks)::int as wrote, count(m.*)::int as total
    from exams ex join batches b on b.id = ex.batch_id join subjects sub on sub.id = ex.subject_id
    left join exam_marks m on m.exam_id = ex.id
    where ex.subject_id = any(${subjects.map((x) => x.id)}) ${batch ? sql`and ex.batch_id = ${batch}` : sql``}
    group by ex.id, b.name, sub.name order by ex.held_on desc, ex.id desc limit 60`;
  return (
    <Shell s={s} active="/teach/exams">
      <div className="row-actions" style={{ justifyContent: "space-between" }}>
        <div><h1>Tests</h1><p className="muted">Enter marks after each test. Students see their score and the topics to revise.</p></div>
        <Link className="btn btn-p" href={`/teach/exams/new${batch ? `?batch=${batch}` : ""}`}>Enter test marks</Link>
      </div>
      <Flash sp={sp} />
      <BatchChips batches={batches} current={batch} base="/teach/exams" all />
      <div className="panel tbl-wrap">
        {exams.length ? (
          <table>
            <thead><tr><th>Date</th><th>Batch</th><th>Subject</th><th>Test</th><th>Wrote</th><th>Class avg</th><th></th></tr></thead>
            <tbody>
              {exams.map((e) => (
                <tr key={e.id}>
                  <td>{fmtDate(e.held_on)}</td><td>{e.batch}</td><td>{e.subject}</td>
                  <td>{e.title}{e.topic && <div className="muted small">{e.topic}</div>}</td>
                  <td className="num">{e.wrote}/{e.total}</td><td className="num">{pct(e.avg)}</td>
                  <td><Link href={`/teach/exams/${e.id}`}>Open</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="muted">No tests yet.</p>
        )}
      </div>
    </Shell>
  );
}
