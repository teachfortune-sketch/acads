import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole, TEACHING } from "@/lib/auth";
import { sql } from "@/lib/db";
import { getStudent } from "@/lib/queries";
import { fmtDate } from "@/lib/util";
import { Flash } from "@/components/Flash";
import { addBehaviourNote, deleteBehaviourNote } from "@/app/admin/actions";
import { Shell } from "@/components/Shell";
import { Classes, Overview, Progress } from "@/components/StudentViews";
import { Feed, QuestHome } from "@/components/Quest";
import { studentFeed } from "@/lib/points";
import { reversePoint } from "@/app/admin/quest-actions";

// Full profile for admin and teachers.
export default async function StudentPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string>> }) {
  const s = await requireRole(...TEACHING);
  const st = await getStudent(Number((await params).id));
  if (!st) notFound();
  const sp = await searchParams;
  const notes = s.role === "admin"
    ? await sql`select id, note, advice, created_at from behaviour_notes where student_id = ${st.id} order by created_at desc`
    : [];
  return (
    <Shell s={s} active={s.role === "admin" ? "/admin" : "/teach"}>
      <div className="row-actions">
        <Link href={s.role === "admin" ? `/admin?batch=${st.batch_id}` : "/teach"} className="btn small">← Back</Link>
        {s.role === "admin" && <Link href={`/admin/people/${st.id}`} className="btn small">Edit login</Link>}
        {s.role === "admin" && <Link href={`/admin/fees/${st.id}`} className="btn small">Fees</Link>}
      </div>
      <div>
        <h1>{st.name}</h1>
        <p className="muted">{st.batch}{st.section ? ` · section ${st.section}` : ""}{st.roll_no ? ` · roll ${st.roll_no}` : ""} · username {st.username}{st.parent ? ` · parent login: ${st.parent}` : ""}</p>
        {(st.school || st.parent_name) && (
          <p className="small">{st.school}{st.parent_name ? ` · parent ${st.parent_name}` : ""}{st.parent_mobile ? <>, <span className="num">{st.parent_mobile}</span></> : ""}</p>
        )}
      </div>
      <Flash sp={sp} />
      <QuestHome st={st} viewer="staff" />
      {s.role === "admin" && <ReversibleFeed id={st.id} />}
      <h2>Classes and homework</h2>
      <Overview st={st} forParent />
      <h2>Progress</h2>
      <Progress st={st} />
      <h2>All classes</h2>
      <Classes st={st} />
      {s.role === "admin" && (
        <div className="panel stack" id="behaviour">
          <div>
            <h2>Behaviour notes (only you can see these)</h2>
            <p className="muted small">Write what you noticed. You can describe it to Claude in chat for advice and paste the advice here.</p>
          </div>
          <form action={addBehaviourNote} className="form">
            <input type="hidden" name="student_id" value={st.id} />
            <label className="full">What you noticed<textarea id="note" name="note" required placeholder="e.g. Distracted in the last 3 maths classes, did not bring homework twice." /></label>
            <label className="full">Advice and plan<textarea id="advice" name="advice" style={{ minHeight: 120 }} /></label>
            <div><button className="btn-p" type="submit">Save note</button></div>
          </form>
          {notes.length > 0 && (
            <ul className="list">
              {notes.map((n) => (
                <li key={n.id}>
                  <div>
                    <div className="muted small">{fmtDate(n.created_at)}</div>
                    <div className="pre">{n.note}</div>
                    {n.advice && <div className="hw pre"><b>Advice:</b> {n.advice}</div>}
                  </div>
                  <form action={deleteBehaviourNote}>
                    <input type="hidden" name="id" value={n.id} />
                    <details><summary className="muted small">Delete</summary><button className="small btn-danger" type="submit">Yes, delete</button></details>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Shell>
  );
}

// The admin can reverse any entry with a note; the reversal is a new entry, so the history stays.
async function ReversibleFeed({ id }: { id: number }) {
  const feed = await studentFeed(id, 100);
  return (
    <details className="panel">
      <summary><b>Reverse a point entry</b> <span className="muted small">(admin only)</span></summary>
      <Feed feed={feed} reverse={(f) => (
        <form action={reversePoint} className="inline-form" style={{ marginTop: 0 }}>
          <input type="hidden" name="id" value={f.id} />
          <input type="hidden" name="student_id" value={id} />
          <input name="note" aria-label="Why" placeholder="Why" required maxLength={140} />
          <button className="small btn-danger" type="submit">Reverse</button>
        </form>
      )} />
    </details>
  );
}
