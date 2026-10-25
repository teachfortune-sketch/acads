import { requireRole } from "@/lib/auth";
import { sql } from "@/lib/db";
import { getStudent, getSubjects } from "@/lib/queries";
import { classSyllabus, groupBooks } from "@/lib/syllabus";
import { addDays, istParts, mondayOf, routineStreak } from "@/lib/points";
import { fmtDate, todayIST } from "@/lib/util";
import { Shell } from "@/components/Shell";
import { Flash } from "@/components/Flash";
import { addBlock, addTask, deleteBlock, deleteTask, shareTask, toggleTask } from "./actions";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export default async function PlannerPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const s = await requireRole("student");
  const sp = await searchParams;
  const st = (await getStudent(s.uid))!;
  const monday = mondayOf(todayIST());
  const [subjects, chapters, blocks, tasks, streak, [check]] = await Promise.all([
    getSubjects(),
    classSyllabus(st.batch_id, st.batch),
    sql`select r.id, r.weekday, r.starts, r.ends, r.note, sub.name as subject from routine_blocks r left join subjects sub on sub.id = r.subject_id
      where r.student_id = ${s.uid} order by r.weekday, r.starts`,
    sql`select t.id, t.text, t.shared, t.done_at, t.verdict, t.comment, t.created_at, sub.name as subject, c.book, c.no, c.name as chapter, v.name as checker
      from study_tasks t join subjects sub on sub.id = t.subject_id left join syllabus_chapters c on c.id = t.chapter_id left join users v on v.id = t.verified_by
      where t.student_id = ${s.uid} and (t.verdict is null or (t.verified_at at time zone 'Asia/Kolkata')::date >= ${addDays(monday, -14)}::date)
      order by (t.verdict is not null), t.created_at desc limit 60`,
    routineStreak(sql, s.uid),
    sql`select days from routine_checks where student_id = ${s.uid} and week_start = ${monday}`,
  ]);
  const bySubject = [...new Map(chapters.map((c) => [c.subject, chapters.filter((x) => x.subject === c.subject)])).entries()];
  return (
    <Shell s={s} active="/planner">
      <div>
        <h1>Planner</h1>
        <p className="muted">Plan your own study. Share tasks with your teacher; when they check your notebook you earn self-study XP.</p>
      </div>
      <Flash sp={sp} />
      <section className="panel stack" aria-labelledby="routine">
        <div className="row-actions" style={{ justifyContent: "space-between" }}>
          <h2 id="routine">My weekly routine</h2>
          <span className="chip c-pink">Routine streak <b className="num">{streak}</b> day{streak === 1 ? "" : "s"}{check ? ` · this week ${check.days}/6` : ""}</span>
        </div>
        <p className="small muted">Your teacher asks at the weekly self-study check how many days you followed it. 5, 10 and 30 days in a row earn bonuses.</p>
        <div className="routine">
          {DAYS.map((d, i) => {
            const mine = blocks.filter((b) => b.weekday === i);
            return (
              <div key={d} className="routine-day">
                <h3>{d}</h3>
                {mine.length ? mine.map((b) => (
                  <div key={b.id} className="rblock">
                    <span className="num small">{b.starts}–{b.ends}</span>
                    <b>{b.subject ?? b.note ?? "Study"}</b>
                    {b.subject && b.note && <span className="small">{b.note}</span>}
                    <form action={deleteBlock}><input type="hidden" name="id" value={b.id} />
                      <button type="submit" className="small" aria-label={`Remove ${b.subject ?? "block"} on ${d} at ${b.starts}`}>×</button></form>
                  </div>
                )) : <p className="small muted">Free</p>}
              </div>
            );
          })}
        </div>
        <form action={addBlock} className="form" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))" }}>
          <label>Day<select name="weekday" defaultValue="0">{DAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}</select></label>
          <label>From<input type="time" name="starts" defaultValue="17:00" required /></label>
          <label>To<input type="time" name="ends" defaultValue="18:00" required /></label>
          <label>Subject<select name="subject_id" defaultValue=""><option value="">Other</option>{subjects.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
          <label>Note<input name="note" maxLength={60} placeholder="e.g. Revision" /></label>
          <div style={{ alignSelf: "end" }}><button type="submit" className="btn-p">Add block</button></div>
        </form>
      </section>

      <section className="panel stack" aria-labelledby="tasks">
        <h2 id="tasks">Self-study tasks</h2>
        <form action={addTask} className="form">
          <label className="full">What will you study?<input name="text" maxLength={200} required placeholder="e.g. Revise Ex 4.2 Q1–10 and write the formulas" /></label>
          <label>Subject<select name="subject_id" defaultValue=""><option value="">From the chapter</option>{subjects.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
          <label>Syllabus chapter
            <select name="chapter_id" defaultValue="">
              <option value="">None</option>
              {bySubject.map(([subject, list]) => groupBooks(list).map((g) => (
                <optgroup key={`${subject}-${g.book}`} label={`${subject} · ${g.book}`}>
                  {g.chapters.map((c) => <option key={c.id} value={c.id}>Ch {c.no} · {c.name}</option>)}
                </optgroup>
              )))}
            </select>
          </label>
          <label className="check full"><input type="checkbox" name="shared" defaultChecked /> Share with my subject teacher</label>
          <div><button type="submit" className="btn-p">Add task</button></div>
        </form>
        {tasks.length ? (
          <ul className="list tasks">
            {tasks.map((t) => (
              <li key={t.id} className={t.done_at ? "done" : ""}>
                <form action={toggleTask}>
                  <input type="hidden" name="id" value={t.id} />
                  <button type="submit" className={`tickbox ${t.done_at ? "on" : ""}`} disabled={!!t.verdict} aria-label={t.done_at ? "Mark not done" : "Mark done"}>{t.done_at ? "✓" : ""}</button>
                </form>
                <div className="task-body">
                  <div><span className="chip">{t.subject}</span> {t.text}</div>
                  {t.chapter && <div className="small muted">{t.book} · Ch {t.no} · {t.chapter}</div>}
                  <div className="small">
                    {t.verdict === "great" ? <span className="chip c-good">Great plan · checked by {t.checker}</span>
                      : t.verdict === "verified" ? <span className="chip c-good">Verified by {t.checker}</span>
                      : !t.shared ? <span className="chip">Private</span>
                      : <span className="chip c-warn">Shared · waiting for your teacher&apos;s check</span>}
                    {" "}<span className="muted">added {fmtDate(istParts(new Date(t.created_at)).day)}</span>
                  </div>
                  {t.comment && <div className="small">“{t.comment}”</div>}
                </div>
                {!t.verdict && (
                  <div className="row-actions">
                    <form action={shareTask}><input type="hidden" name="id" value={t.id} /><button type="submit" className="small">{t.shared ? "Make private" : "Share"}</button></form>
                    <form action={deleteTask}><input type="hidden" name="id" value={t.id} /><button type="submit" className="small">Remove</button></form>
                  </div>
                )}
              </li>
            ))}
          </ul>
        ) : <p className="muted">No tasks yet. Add what you plan to study at home this week.</p>}
      </section>
    </Shell>
  );
}
