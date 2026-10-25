import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { sql } from "@/lib/db";
import { getBatches } from "@/lib/queries";
import { addDays, batchBoard } from "@/lib/points";
import { expectedPace, paceReport } from "@/lib/syllabus";
import { fmtDate, todayIST } from "@/lib/util";
import { Shell } from "@/components/Shell";
import { BatchChips } from "@/components/BatchChips";
import { PillarBar, PillarLegend } from "@/components/Quest";

const PERIODS = [7, 30, 90];

export default async function ReportsPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const s = await requireRole("admin");
  const sp = await searchParams;
  const batches = await getBatches();
  const batch = batches.find((b) => b.id === Number(sp.batch)) ?? null;
  const days = PERIODS.includes(Number(sp.days)) ? Number(sp.days) : 30;
  const today = todayIST(), from = addDays(today, -(days - 1));
  const bid = batch?.id ?? null;
  const [board, late, lateByStudent, byReason, byStaff, log, pace] = await Promise.all([
    bid ? batchBoard(bid) : Promise.resolve([]),
    sql`select g.day::date::text as day, count(d.student_id)::int as n
      from generate_series(${from}::date, ${today}::date, interval '1 day') g(day)
      left join day_attendance d on d.day = g.day and d.status = 'late' and (${bid}::int is null or d.batch_id = ${bid})
      group by g.day order by g.day`,
    sql`select u.id, u.name, b.name as batch, count(*)::int as n from day_attendance d join users u on u.id = d.student_id join batches b on b.id = d.batch_id
      where d.status = 'late' and d.day >= ${from} and (${bid}::int is null or d.batch_id = ${bid})
      group by u.id, u.name, b.name order by n desc, u.name limit 10`,
    sql`select p.action, count(*)::int as n, coalesce(sum(p.xp), 0)::int as xp from points p join students st on st.user_id = p.student_id
      where p.pillar = 'discipline' and p.xp < 0 and p.reversed_by_id is null and p.reverses_id is null and p.day >= ${from}
        and (${bid}::int is null or st.batch_id = ${bid}) group by p.action order by n desc`,
    sql`select coalesce(u.name, 'Acads') as staff, u.role, count(*)::int as n, coalesce(sum(p.xp), 0)::int as xp
      from points p join students st on st.user_id = p.student_id left join users u on u.id = p.staff_id
      where p.pillar = 'discipline' and p.xp < 0 and p.reversed_by_id is null and p.reverses_id is null and p.day >= ${from}
        and (${bid}::int is null or st.batch_id = ${bid}) group by u.name, u.role order by n desc`,
    sql`select p.id, p.day::text, p.reason, p.note, p.xp, p.reversed_by_id is not null as reversed, s.name as student, s.id as student_id,
        b.name as batch, coalesce(u.name, 'Acads') as staff
      from points p join users s on s.id = p.student_id join students st on st.user_id = p.student_id join batches b on b.id = st.batch_id
      left join users u on u.id = p.staff_id
      where p.pillar = 'discipline' and p.xp < 0 and p.reverses_id is null and p.day >= ${from} and (${bid}::int is null or st.batch_id = ${bid})
      order by p.created_at desc limit 50`,
    paceReport(),
  ]);
  const peak = Math.max(1, ...late.map((r) => r.n));
  const half = Math.floor(late.length / 2);
  const firstHalf = late.slice(0, half).reduce((a, r) => a + r.n, 0), secondHalf = late.slice(half).reduce((a, r) => a + r.n, 0);
  const expected = expectedPace();
  const q = (extra: Record<string, string | number | null>) => {
    const p = new URLSearchParams();
    const all = { batch: bid, days, ...extra };
    for (const [k, v] of Object.entries(all)) if (v != null) p.set(k, String(v));
    return `/admin/reports?${p}`;
  };
  return (
    <Shell s={s} active="/admin/reports">
      <div>
        <h1>Reports</h1>
        <p className="muted">Points, late arrivals, discipline and syllabus pace. Pick a class to narrow everything down.</p>
      </div>
      <BatchChips batches={batches} current={bid} base={`/admin/reports?days=${days}`} all />
      <div className="chips" aria-label="Period">
        {PERIODS.map((d) => <Link key={d} href={q({ days: d })} aria-current={d === days}>Last {d} days</Link>)}
      </div>

      {batch ? (
        <section className="panel tbl-wrap" aria-labelledby="lb">
          <div className="row-actions" style={{ justifyContent: "space-between" }}>
            <h2 id="lb">Leaderboard: {batch.name}</h2>
            <Link href={`/board?batch=${batch.id}`} className="btn small">Full leaderboard</Link>
          </div>
          <table>
            <thead><tr><th>#</th><th>Student</th><th>Net XP</th><th>Level</th><th>Deductions</th><th style={{ minWidth: 140 }}>Five pillars</th><th>Ledger</th></tr></thead>
            <tbody>
              {board.map((r) => (
                <tr key={r.id}>
                  <td className="num">{r.rank}</td><td><b>{r.name}</b></td><td className="num">{r.net}</td><td className="small">L{r.level} · {r.title}</td>
                  <td className="num">{r.deductions}</td><td><PillarBar p={r.pillars} /></td>
                  <td><Link href={`/students/${r.id}#points`} className="small">Every entry</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
          <PillarLegend />
        </section>
      ) : (
        <p className="small muted">Pick a class above to see its leaderboard and each student&apos;s full ledger.</p>
      )}

      <section className="panel" aria-labelledby="late">
        <h2 id="late">Late arrivals{batch ? `: ${batch.name}` : ""}</h2>
        <p className="small">
          <b className="num">{firstHalf + secondHalf}</b> late arrivals in the last {days} days.
          {firstHalf > 0 && <> The second half of the period had <b className="num">{Math.round(((secondHalf - firstHalf) / firstHalf) * 100)}%</b> {secondHalf <= firstHalf ? "fewer" : "more"} than the first half.</>}
        </p>
        <div className="trend" role="img" aria-label={`Late arrivals per day: ${late.map((r) => `${r.day} ${r.n}`).join(", ")}`}>
          {late.map((r) => (
            <span key={r.day} title={`${fmtDate(r.day)}: ${r.n} late`} style={{ height: `${Math.max(2, (r.n / peak) * 100)}%` }} className={r.n ? "" : "zero"} />
          ))}
        </div>
        <div className="trend-axis small muted"><span>{fmtDate(from)}</span><span>peak {peak}/day</span><span>{fmtDate(today)}</span></div>
        {lateByStudent.length > 0 && (
          <>
            <h3 style={{ marginTop: 14 }}>Most often late</h3>
            <ul className="list">
              {lateByStudent.map((r) => (
                <li key={r.id}><Link href={`/students/${r.id}`}>{r.name}</Link> <span className="muted small">{r.batch}</span> <span className="chip c-warn num">{r.n}×</span></li>
              ))}
            </ul>
          </>
        )}
      </section>

      <section className="grid" aria-label="Discipline">
        <div className="panel tbl-wrap">
          <h2>Discipline by reason</h2>
          {byReason.length ? (
            <table><thead><tr><th>Reason</th><th>Times</th><th>XP</th></tr></thead>
              <tbody>{byReason.map((r) => <tr key={r.action}><td>{REASON[r.action] ?? r.action}</td><td className="num">{r.n}</td><td className="num">{r.xp}</td></tr>)}</tbody></table>
          ) : <p className="muted">No deductions in this period.</p>}
        </div>
        <div className="panel tbl-wrap">
          <h2>Discipline by staff</h2>
          {byStaff.length ? (
            <table><thead><tr><th>Staff</th><th>Times</th><th>XP</th></tr></thead>
              <tbody>{byStaff.map((r) => <tr key={r.staff}><td>{r.staff} {r.role && <span className="chip small">{r.role}</span>}</td><td className="num">{r.n}</td><td className="num">{r.xp}</td></tr>)}</tbody></table>
          ) : <p className="muted">No deductions in this period.</p>}
        </div>
      </section>

      <section className="panel tbl-wrap" aria-labelledby="dlog">
        <h2 id="dlog">Discipline log</h2>
        {log.length ? (
          <table>
            <thead><tr><th>Day</th><th>Student</th><th>Class</th><th>Reason</th><th>XP</th><th>By</th></tr></thead>
            <tbody>
              {log.map((r) => (
                <tr key={r.id} className={r.reversed ? "struck" : ""}>
                  <td className="small">{fmtDate(r.day)}</td>
                  <td><Link href={`/students/${r.student_id}#points`}>{r.student}</Link></td>
                  <td className="small">{r.batch}</td>
                  <td>{r.reason}{r.note ? <span className="small muted"> · “{r.note}”</span> : null}{r.reversed ? <span className="chip small">reversed</span> : null}</td>
                  <td className="num">{r.xp}</td><td className="small">{r.staff}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <p className="muted">No deductions in this period.</p>}
      </section>

      <section className="panel tbl-wrap" aria-labelledby="pace">
        <h2 id="pace">Syllabus pace</h2>
        <p className="small">By {fmtDate(today)} about <b className="num">{Math.round(expected * 100)}%</b> of each subject should be taught (April to February). Classes more than 10 points behind are flagged.</p>
        <table>
          <thead><tr><th>Class</th><th>Subject</th><th>Taught</th><th style={{ minWidth: 120 }}>Progress</th><th>Pace</th></tr></thead>
          <tbody>
            {pace.filter((r) => !bid || r.batch_id === bid).map((r) => {
              const pct = r.total ? r.taught / r.total : 0, behind = expected - pct > 0.1;
              return (
                <tr key={`${r.batch_id}-${r.subject}`}>
                  <td>{r.batch}</td><td>{r.subject}</td><td className="num">{r.taught}/{r.total}</td>
                  <td><span className="xpbar thin" style={{ display: "block" }}><span style={{ width: `${pct * 100}%` }} /></span></td>
                  <td>{behind ? <span className="chip c-bad">Behind</span> : <span className="chip c-good">On pace</span>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </Shell>
  );
}

const REASON: Record<string, string> = {
  disc_uniform: "Uniform", disc_phone: "Phone found", disc_disruption: "Disruption", disc_misbehaviour: "Misbehaviour", disc_other: "Other", inattentive: "Inattentive",
};
