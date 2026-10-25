import Link from "next/link";
import { fmtDate, level, pct } from "@/lib/util";
import {
  LectureRow, noticesForStudent, pendingHomework, remarksFor, StudentInfo, studentExams, studentLectures, studentSheets, studentTasks,
  subjectStats, totals, upcomingForBatch,
} from "@/lib/queries";
import { toggleSheet, toggleTask } from "@/app/me/actions";

const color = (x: number) => (x >= 0.8 ? "var(--good)" : x >= 0.6 ? "var(--mark)" : "var(--bad)");
export function Bar({ x }: { x: number | null }) {
  return (
    <div className="bar">
      <span style={{ width: `${Math.round((x ?? 0) * 100)}%`, background: color(x ?? 0) }} />
    </div>
  );
}
const ratio = (a: number, b: number) => (b ? a / b : null);

function MissedList({ rows }: { rows: LectureRow[] }) {
  if (!rows.length) return <p className="muted">No missed classes. Well done.</p>;
  return (
    <ul className="list">
      {rows.map((l) => (
        <li key={l.id}>
          <div className="missed">
            <b>{l.subject}</b>: {l.topic}
            <div className="muted small">{fmtDate(l.held_on)} · {l.teacher}</div>
            {l.notes && <div className="small pre">{l.notes}</div>}
            {l.homework && <div className="hw"><b>Homework:</b> {l.homework}</div>}
          </div>
        </li>
      ))}
    </ul>
  );
}

async function Notices({ st }: { st: StudentInfo }) {
  const notices = await noticesForStudent(st.id, st.batch_id);
  return (
    <div className="panel">
      <h2>Notices</h2>
      {notices.length ? (
        <ul className="list">
          {notices.map((n) => (
            <li key={n.id}>
              <div>
                <div className="pre">{n.body}</div>
                <div className="muted small">{n.author} · {fmtDate(n.created_at)} · {n.target}</div>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted">No notices yet.</p>
      )}
    </div>
  );
}

async function Remarks({ st }: { st: StudentInfo }) {
  const remarks = await remarksFor(st.id);
  return (
    <div className="panel">
      <h2>Teacher remarks</h2>
      {remarks.length ? (
        <ul className="list">
          {remarks.map((r) => (
            <li key={r.id}>
              <div>
                <div className="pre">{r.body}</div>
                <div className="muted small">{r.author}{r.subject ? ` · ${r.subject}` : ""} · {fmtDate(r.created_at)}</div>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted">No remarks yet.</p>
      )}
    </div>
  );
}

export async function StatTiles({ st }: { st: StudentInfo }) {
  const t = totals(await subjectStats(st.id));
  return (
    <div className="grid">
      {([["Attendance", t.att], ["Homework submitted", t.hw], ["Test average", t.score]] as const).map(([label, v]) => (
        <div className="panel" key={label}>
          <div className="muted small">{label}</div>
          <div className="big num">{pct(v)}</div>
          <Bar x={v} />
        </div>
      ))}
    </div>
  );
}

async function ComingUp({ st }: { st: StudentInfo }) {
  const plans = await upcomingForBatch(st.batch_id);
  return (
    <div className="panel">
      <h2>Coming up</h2>
      {plans.length ? (
        <ul className="list">
          {plans.map((p) => (
            <li key={p.id}>
              <div>
                <b>{p.kind === "test" ? "Test: " : ""}{p.subject}</b>: {p.topic}
                <div className="muted small">{fmtDate(p.planned_on)}{p.start_time ? ` at ${p.start_time}` : ""} · {p.teacher}</div>
                {p.prerequisites && <div className="prereq"><b>Before this {p.kind}:</b> {p.prerequisites}</div>}
              </div>
              {p.kind === "test" && <span className="chip c-warn">Test</span>}
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted">Nothing planned for the next two weeks yet.</p>
      )}
    </div>
  );
}

// canTick: only the student themself can mark their work done.
async function Work({ st, canTick }: { st: StudentInfo; canTick: boolean }) {
  const [tasks, sheets] = await Promise.all([studentTasks(st.id), studentSheets(st.id)]);
  const Tick = ({ action, id, done }: { action: (fd: FormData) => Promise<void>; id: number; done: boolean }) =>
    canTick ? (
      <form action={action}>
        <input type="hidden" name="id" value={id} />
        <button className="small" type="submit" aria-label={done ? "Mark as not done" : "Mark as done"}>{done ? "✓ Done" : "Mark done"}</button>
      </form>
    ) : (
      <span className={`chip ${done ? "c-good" : "c-warn"}`}>{done ? "Done" : "Pending"}</span>
    );
  return (
    <div className="grid">
      <div className="panel">
        <h2>Tasks from teachers</h2>
        {tasks.length ? (
          <ul className="list">
            {tasks.map((t) => (
              <li key={t.id}>
                <div style={t.done ? { opacity: 0.6 } : undefined}>
                  <b>{t.subject}</b>: {t.title}
                  <div className="muted small">{t.teacher}{t.due_on ? ` · due ${fmtDate(t.due_on)}` : ""}{t.topic ? ` · after: ${t.topic}` : ""}</div>
                  {t.details && <div className="small pre">{t.details}</div>}
                </div>
                <Tick action={toggleTask} id={t.id} done={t.done} />
              </li>
            ))}
          </ul>
        ) : <p className="muted">No tasks right now.</p>}
      </div>
      <div className="panel">
        <h2>Worksheets</h2>
        {sheets.length ? (
          <ul className="list">
            {sheets.map((sh) => (
              <li key={sh.id}>
                <div style={sh.done ? { opacity: 0.6 } : undefined}>
                  <Link href={`/sheets/${sh.id}`}><b>Sheet {sh.number}</b>: {sh.title}</Link>
                  <div className="muted small">{sh.subject ?? "All subjects"}{sh.due_on ? ` · due ${fmtDate(sh.due_on)}` : ""}</div>
                </div>
                <Tick action={toggleSheet} id={sh.id} done={sh.done} />
              </li>
            ))}
          </ul>
        ) : <p className="muted">No worksheets yet.</p>}
      </div>
    </div>
  );
}

export async function Overview({ st, forParent }: { st: StudentInfo; forParent?: boolean }) {
  const [missed, pending] = await Promise.all([studentLectures(st.id, true, 8), pendingHomework(st.id)]);
  return (
    <>
      {forParent && <StatTiles st={st} />}
      <ComingUp st={st} />
      <Work st={st} canTick={!forParent} />
      <div className="grid">
        <div className="panel">
          <h2>Classes {forParent ? "missed" : "you missed"}</h2>
          <p className="muted small">Read the notes and finish the homework before the next class.</p>
          <MissedList rows={missed} />
        </div>
        <div className="stack">
          <div className="panel">
            <h2>Homework pending</h2>
            {pending.length ? (
              <ul className="list">
                {pending.map((l) => (
                  <li key={l.id}>
                    <div>
                      <b>{l.subject}</b>: {l.homework}
                      <div className="muted small">Given {fmtDate(l.held_on)}</div>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted">All homework submitted.</p>
            )}
          </div>
          {forParent ? <Remarks st={st} /> : <Notices st={st} />}
        </div>
      </div>
      {forParent ? <Notices st={st} /> : <Remarks st={st} />}
    </>
  );
}

export async function Progress({ st }: { st: StudentInfo }) {
  const [stats, exams] = await Promise.all([subjectStats(st.id), studentExams(st.id)]);
  const weak = exams.filter((e) => e.marks != null && e.marks / e.max_marks < 0.6);
  return (
    <>
      <p className="muted">Each subject is marked Strong (80%+), On track (60–79%) or Needs help (under 60%) from test scores.</p>
      <div className="panel">
        <h2>What to work on next</h2>
        {weak.length ? (
          <>
            <p className="muted small">Tests where the score was under 60%. Revise these topics first.</p>
            <ul className="list">
              {weak.map((e) => (
                <li key={e.id}>
                  <div>
                    <b>{e.subject}</b>: {e.topic || e.title}
                    <div className="muted small">{e.title}, {fmtDate(e.held_on)} · <span className="num">{e.marks}/{e.max_marks}</span></div>
                  </div>
                  <span className="chip c-bad">Revise</span>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="muted">No weak topics in tests so far. Keep it up.</p>
        )}
      </div>
      <div className="grid">
        {stats.map((r) => {
          const [l, c] = level(r.score);
          const att = ratio(r.present, r.classes), hw = ratio(r.hw_done, r.hw_total);
          const subjExams = exams.filter((e) => e.subject === r.subject).slice(0, 4);
          return (
            <div className="panel subj" key={r.subject_id}>
              <div className="row"><h3>{r.subject}</h3><span className={`chip ${c}`}>{l}</span></div>
              <div className="row"><span>Tests</span><span className="num">{pct(r.score)}</span></div>
              <Bar x={r.score} />
              <div className="row"><span>Attendance ({r.present}/{r.classes})</span><span className="num">{pct(att)}</span></div>
              <Bar x={att} />
              <div className="row"><span>Homework ({r.hw_done}/{r.hw_total})</span><span className="num">{pct(hw)}</span></div>
              <Bar x={hw} />
              {subjExams.length > 0 && (
                <div className="small muted">
                  {subjExams.map((e) => `${e.title}: ${e.marks != null ? `${e.marks}/${e.max_marks}` : "absent"}`).join(" · ")}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}

export async function Classes({ st }: { st: StudentInfo }) {
  const rows = await studentLectures(st.id);
  if (!rows.length) return <div className="panel"><p className="muted">No classes logged yet.</p></div>;
  return (
    <div className="panel tbl-wrap">
      <table>
        <thead>
          <tr><th>Date</th><th>Subject</th><th>Topic</th><th>Present</th><th>Homework</th></tr>
        </thead>
        <tbody>
          {rows.map((l) => (
            <tr key={l.id}>
              <td>{fmtDate(l.held_on)}</td>
              <td>{l.subject}</td>
              <td>
                {l.topic}
                {!l.present && l.notes && <div className="muted small pre">{l.notes}</div>}
                {l.homework && <div className="muted small">Homework: {l.homework}</div>}
              </td>
              <td><span className={`chip ${l.present ? "c-good" : "c-bad"}`}>{l.present ? "Present" : "Absent"}</span></td>
              <td>{l.homework ? <span className={`chip ${l.homework_done ? "c-good" : "c-warn"}`}>{l.homework_done ? "Done" : "Pending"}</span> : "–"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
