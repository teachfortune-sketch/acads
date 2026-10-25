import Link from "next/link";
import { requireRole, TEACHING } from "@/lib/auth";
import { sql } from "@/lib/db";
import { getBatches, teachableSubjects } from "@/lib/queries";
import { todayIST } from "@/lib/util";
import { Shell } from "@/components/Shell";
import { Flash } from "@/components/Flash";
import { BatchChips } from "@/components/BatchChips";
import { createPlan } from "../plan-actions";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function monthInfo(month: string) {
  const [y, m] = month.split("-").map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1));
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const lead = (first.getUTCDay() + 6) % 7; // Monday first
  const shift = (d: number) => new Date(Date.UTC(y, m - 1 + d, 1)).toISOString().slice(0, 7);
  const label = first.toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" });
  return { y, m, days, lead, prev: shift(-1), next: shift(1), label };
}

export default async function CalendarPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const s = await requireRole(...TEACHING);
  const sp = await searchParams;
  const today = todayIST();
  const month = /^\d{4}-\d{2}$/.test(sp.month ?? "") ? sp.month : today.slice(0, 7);
  const batch = Number(sp.batch) || null;
  const { y, m, days, lead, prev, next, label } = monthInfo(month);
  const [batches, subjects] = await Promise.all([getBatches(), teachableSubjects(s)]);
  const plans = await sql`
    select p.id, p.kind, extract(day from p.planned_on)::int as day, p.start_time, p.topic, sub.name as subject, b.name as batch,
      (p.lecture_id is not null or p.exam_id is not null) as done
    from schedule p join subjects sub on sub.id = p.subject_id join batches b on b.id = p.batch_id
    where date_trunc('month', p.planned_on) = ${month + "-01"}::date
      and p.subject_id = any(${subjects.map((x) => x.id)}) ${batch ? sql`and p.batch_id = ${batch}` : sql``}
    order by p.planned_on, p.start_time`;
  const cells: (number | null)[] = [...Array(lead).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
  while (cells.length % 7) cells.push(null);
  const base = `/teach/calendar?month=${month}`;
  return (
    <Shell s={s} active="/teach/calendar">
      <div><h1>Calendar</h1><p className="muted">Plan classes and tests ahead. Students and parents see the next two weeks with the prerequisites.</p></div>
      <Flash sp={sp} />
      <div className="row-actions" style={{ justifyContent: "space-between" }}>
        <div className="row-actions">
          <Link className="btn small" href={`/teach/calendar?month=${prev}${batch ? `&batch=${batch}` : ""}`}>← Previous</Link>
          <h2>{label}</h2>
          <Link className="btn small" href={`/teach/calendar?month=${next}${batch ? `&batch=${batch}` : ""}`}>Next →</Link>
        </div>
      </div>
      <BatchChips batches={batches} current={batch} base={base} all />
      <div className="panel tbl-wrap">
        <table className="cal">
          <thead><tr>{DAYS.map((d) => <th key={d}>{d}</th>)}</tr></thead>
          <tbody>
            {Array.from({ length: cells.length / 7 }, (_, w) => (
              <tr key={w}>
                {cells.slice(w * 7, w * 7 + 7).map((d, i) => {
                  const iso = d ? `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}` : "";
                  return (
                    <td key={i} className={iso === today ? "cal-today" : ""}>
                      {d && <div className="cal-day num">{d}</div>}
                      {plans.filter((p) => p.day === d).map((p) => (
                        <Link key={p.id} href={`/teach/plan/${p.id}`} className={`cal-item ${p.kind === "test" ? "cal-test" : ""} ${p.done ? "cal-done" : ""}`}>
                          {p.start_time && <span className="num">{p.start_time} </span>}
                          <b>{p.kind === "test" ? "Test · " : ""}{p.subject}</b> {p.batch.replace("Class ", "C")}: {p.topic}
                        </Link>
                      ))}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="panel">
        <h2>Plan a class or test</h2>
        <form action={createPlan} className="form" style={{ marginTop: 10 }}>
          <label>Type
            <select id="kind" name="kind"><option value="class">Class</option><option value="test">Test</option></select>
          </label>
          <label>Batch
            <select id="batch_id" name="batch_id" defaultValue={batch ?? undefined} required>{batches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select>
          </label>
          <label>Subject
            <select id="subject_id" name="subject_id" required>{subjects.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select>
          </label>
          <label>Date<input id="planned_on" name="planned_on" type="date" defaultValue={month === today.slice(0, 7) ? today : `${month}-01`} required /></label>
          <label>Time<input id="start_time" name="start_time" type="time" /></label>
          <label className="full">Topic<input id="topic" name="topic" required placeholder="e.g. Triangles: congruence rules" /></label>
          <label className="full">Prerequisites (what students should revise or bring)<textarea id="prerequisites" name="prerequisites" placeholder="e.g. Revise lines and angles. Bring a geometry box." /></label>
          <div><button className="btn-p" type="submit">Add to calendar</button></div>
        </form>
      </div>
    </Shell>
  );
}
