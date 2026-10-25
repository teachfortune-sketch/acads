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
      </div>
      <div>
        <h1>{st.name}</h1>
        <p className="muted">{st.batch} · username {st.username}{st.parent ? ` · parent: ${st.parent}` : ""}</p>
      </div>
      <Flash sp={sp} />
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
