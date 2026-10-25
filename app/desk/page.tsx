import { requireRole } from "@/lib/auth";
import { sql } from "@/lib/db";
import { getRules } from "@/lib/points";
import { todayIST } from "@/lib/util";
import { Shell } from "@/components/Shell";
import { Desk, DeskUndo } from "@/components/Desk";

export default async function DeskPage() {
  const s = await requireRole("admin", "reception");
  const day = todayIST();
  const rules = await getRules();
  const students = await sql`
    select u.id, u.name, b.name as batch, st.section, st.roll_no as roll, d.arrived_at as late
    from students st join users u on u.id = st.user_id and u.active and u.status = 'approved' join batches b on b.id = st.batch_id
    left join day_attendance d on d.student_id = u.id and d.day = ${day} and d.status = 'late'
    order by u.name`;
  // Today's late list, with how often each student was late this month so repeat offenders stand out.
  const late = await sql`
    select d.student_id, u.name, b.name as batch, d.arrived_at, m.name as marked_by, d.marked_by as marked_by_id,
      d.updated_at > now() - interval '10 minutes' as fresh,
      (select count(*)::int from day_attendance x where x.student_id = d.student_id and x.status = 'late'
        and date_trunc('month', x.day) = date_trunc('month', ${day}::date)) as month_count
    from day_attendance d join users u on u.id = d.student_id join batches b on b.id = d.batch_id join users m on m.id = d.marked_by
    where d.day = ${day} and d.status = 'late' order by d.arrived_at desc, u.name`;
  const discipline = await sql`
    select p.id, p.reason, p.xp, p.note, p.staff_id, u.name, st.name as staff, p.created_at > now() - interval '10 minutes' as fresh
    from points p join users u on u.id = p.student_id left join users st on st.id = p.staff_id
    where p.day = ${day} and p.pillar = 'discipline' and p.xp < 0 and p.reversed_by_id is null and p.reverses_id is null
    order by p.created_at desc limit 50`;
  return (
    <Shell s={s} active="/desk">
      <div><h1>Reception desk</h1><p className="muted">Find the student, then one tap for Late or a discipline reason. The time is saved automatically.</p></div>
      <Desk students={students.map((x) => ({ id: x.id, name: x.name, batch: x.batch, section: x.section, roll: x.roll, late: x.late }))}
        values={{ otherMax: Number(rules.disc_other_max), disc: { uniform: Number(rules.disc_uniform), phone: Number(rules.disc_phone), disruption: Number(rules.disc_disruption), misbehaviour: Number(rules.disc_misbehaviour) } }} />
      <div className="grid">
        <div className="panel">
          <h2>Late today <span className="chip c-warn">{late.length}</span></h2>
          {late.length ? (
            <ul className="list">
              {late.map((r) => (
                <li key={r.student_id}>
                  <div>
                    <b>{r.name}</b> <span className="muted small">{r.batch}</span>
                    <div className="small"><span className="num">{r.arrived_at || "–"}</span> · by {r.marked_by}
                      {r.month_count > 1 && <> · <span className={`chip ${r.month_count >= 3 ? "c-bad" : "c-warn"}`}>{r.month_count}× this month</span></>}</div>
                  </div>
                  {r.fresh && (s.role === "admin" || r.marked_by_id === s.uid) && <DeskUndo action={{ type: "unlate", student: r.student_id }} label="Undo" />}
                </li>
              ))}
            </ul>
          ) : <p className="muted">Nobody late yet today.</p>}
        </div>
        <div className="panel">
          <h2>Discipline today</h2>
          {discipline.length ? (
            <ul className="list">
              {discipline.map((r) => (
                <li key={r.id}>
                  <div>
                    <b>{r.name}</b> · {r.reason} <span className="num">{r.xp}</span>
                    <div className="muted small">{r.staff}{r.note ? ` · “${r.note}”` : ""}</div>
                  </div>
                  {r.fresh && r.staff_id === s.uid && <DeskUndo action={{ type: "undo", point: r.id }} label="Undo" />}
                </li>
              ))}
            </ul>
          ) : <p className="muted">No deductions today.</p>}
        </div>
      </div>
    </Shell>
  );
}
