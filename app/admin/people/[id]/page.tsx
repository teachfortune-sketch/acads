import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { sql } from "@/lib/db";
import { getBatches, getSubjects } from "@/lib/queries";
import { Shell } from "@/components/Shell";
import { Flash } from "@/components/Flash";
import { resetPassword, updateUser } from "../../actions";

export default async function EditUserPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string>> }) {
  const s = await requireRole("admin");
  const sp = await searchParams;
  const [u] = await sql`
    select u.id, u.name, u.username, u.role, u.active, st.batch_id, st.parent_id
    from users u left join students st on st.user_id = u.id where u.id = ${Number((await params).id) || 0}`;
  if (!u) notFound();
  const [batches, subjects] = await Promise.all([getBatches(), getSubjects()]);
  const mine = (await sql`select subject_id from teacher_subjects where teacher_id = ${u.id}`).map((r) => r.subject_id);
  const parents = u.role === "student" ? await sql`select id, name, username from users where role = 'parent' order by name` : [];
  const isSelf = u.id === s.uid;
  return (
    <Shell s={s} active="/admin/people">
      <div className="row-actions">
        <Link href="/admin/people" className="btn small">← Logins</Link>
        {u.role === "student" && <Link href={`/students/${u.id}`} className="btn small">View progress</Link>}
      </div>
      <div><h1>{u.name}</h1><p className="muted">{u.role} · username <span className="num">{u.username}</span></p></div>
      <Flash sp={sp} />
      <div className="grid">
        <form action={updateUser} className="panel form">
          <input type="hidden" name="id" value={u.id} />
          <label className="full">Name<input id="name" name="name" defaultValue={u.name} required /></label>
          {u.role === "student" && (
            <>
              <label>Batch
                <select id="batch_id" name="batch_id" defaultValue={u.batch_id}>{batches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select>
              </label>
              <label>Parent login
                <select id="parent_id" name="parent_id" defaultValue={u.parent_id ?? ""}>
                  <option value="">None</option>
                  {parents.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.username})</option>)}
                </select>
              </label>
            </>
          )}
          {(u.role === "teacher" || u.role === "admin") && (
            <div className="full">
              <b className="small">Subjects</b>
              <div className="checks" style={{ marginTop: 6 }}>
                {subjects.map((x) => (
                  <label key={x.id}><input type="checkbox" id={`sub_${x.id}`} name="subjects" value={x.id} defaultChecked={mine.includes(x.id)} />{x.name}</label>
                ))}
              </div>
            </div>
          )}
          {!isSelf && (
            <div className="full checks">
              <label><input type="checkbox" id="active" name="active" defaultChecked={u.active} />Login is active (untick to stop this person signing in)</label>
            </div>
          )}
          <div><button className="btn-p" type="submit">Save</button></div>
        </form>
        <form action={resetPassword} className="panel stack">
          <input type="hidden" name="id" value={u.id} />
          <h2>Change password</h2>
          <p className="muted small">{isSelf ? "You will be signed out and need to sign in with the new password." : "They will be signed out and need the new password to sign in again."}</p>
          <label>New password<input id="password" name="password" required minLength={6} /></label>
          <div><button className="btn-p" type="submit">Change password</button></div>
        </form>
      </div>
    </Shell>
  );
}
