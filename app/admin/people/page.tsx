import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { sql } from "@/lib/db";
import { getBatches, getSubjects } from "@/lib/queries";
import { Shell } from "@/components/Shell";
import { Flash } from "@/components/Flash";
import { createParent, createStudent, createTeacher } from "../actions";

const ROLE_ORDER = ["admin", "teacher", "reception", "student", "parent"];

export default async function PeoplePage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const s = await requireRole("admin");
  const sp = await searchParams;
  const [batches, subjects] = await Promise.all([getBatches(), getSubjects()]);
  const users = await sql`
    select u.id, u.name, u.username, u.role, u.active, u.status, b.name as batch, p.name as parent, st.roll_no,
      (select string_agg(c.name, ', ' order by c.name) from students cs join users c on c.id = cs.user_id where cs.parent_id = u.id) as children,
      (select string_agg(sub.name, ', ' order by sub.sort) from teacher_subjects ts join subjects sub on sub.id = ts.subject_id where ts.teacher_id = u.id) as subjects
    from users u left join students st on st.user_id = u.id left join batches b on b.id = st.batch_id left join users p on p.id = st.parent_id
    order by array_position(${ROLE_ORDER}::text[], u.role), b.name nulls first, u.name`;
  const parents = users.filter((u) => u.role === "parent");
  return (
    <Shell s={s} active="/admin/people">
      <div><h1>Logins</h1><p className="muted">Create logins here, or let students sign up themselves and approve them under Approvals. Only you can change passwords. Usernames use small letters, numbers, dot or underscore.</p></div>
      <Flash sp={sp} />
      <div className="grid">
        <details className="panel" open>
          <summary><h2 style={{ display: "inline" }}>Add a student</h2></summary>
          <form action={createStudent} className="form" style={{ marginTop: 12 }}>
            <label className="full">Student's name<input id="s_name" name="name" required /></label>
            <label>Username<input id="s_username" name="username" required autoCapitalize="none" placeholder="e.g. aarav.s" /></label>
            <label>Password<input id="s_password" name="password" required minLength={6} /></label>
            <label className="full">Batch
              <select id="s_batch" name="batch_id" required>{batches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select>
            </label>
            <label>Section<input id="s_section" name="section" maxLength={10} placeholder="optional" /></label>
            <label>Roll number<input id="s_roll" name="roll_no" maxLength={10} placeholder="for the reception desk" /></label>
            <label className="full">Parent login
              <select id="s_parent_mode" name="parent_mode" defaultValue="new">
                <option value="new">Create a new parent login (fill in below)</option>
                <option value="existing">Use an existing parent (for brothers and sisters)</option>
                <option value="none">No parent login for now</option>
              </select>
            </label>
            <label>Parent's name<input id="s_parent_name" name="parent_name" placeholder="e.g. Mrs. Sharma" /></label>
            <label>Parent username<input id="s_parent_username" name="parent_username" autoCapitalize="none" placeholder="e.g. aarav.parent" /></label>
            <label>Parent password<input id="s_parent_password" name="parent_password" /></label>
            <label>Existing parent
              <select id="s_parent_id" name="parent_id">
                <option value="">Choose…</option>
                {parents.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.username})</option>)}
              </select>
            </label>
            <div><button className="btn-p" type="submit">Add student</button></div>
          </form>
        </details>
        <div className="stack">
          <details className="panel">
            <summary><h2 style={{ display: "inline" }}>Add staff</h2></summary>
            <form action={createTeacher} className="form" style={{ marginTop: 12 }}>
              <label className="full">Name<input id="t_name" name="name" required /></label>
              <label className="full">Role
                <select id="t_role" name="role" defaultValue="teacher">
                  <option value="teacher">Teacher (class mode, homework, marks)</option>
                  <option value="reception">Reception (late arrivals and discipline at the desk)</option>
                  <option value="admin">Admin (everything)</option>
                </select>
              </label>
              <label>Username<input id="t_username" name="username" required autoCapitalize="none" /></label>
              <label>Password<input id="t_password" name="password" required minLength={6} /></label>
              <div className="full">
                <b className="small">Subjects they teach (teachers and admins)</b>
                <div className="checks" style={{ marginTop: 6 }}>
                  {subjects.map((x) => <label key={x.id}><input type="checkbox" id={`t_sub_${x.id}`} name="subjects" value={x.id} />{x.name}</label>)}
                </div>
              </div>
              <div><button className="btn-p" type="submit">Add staff</button></div>
            </form>
          </details>
          <details className="panel">
            <summary><h2 style={{ display: "inline" }}>Add a parent only</h2></summary>
            <form action={createParent} className="form" style={{ marginTop: 12 }}>
              <label className="full">Parent's name<input id="p_name" name="name" required /></label>
              <label>Username<input id="p_username" name="username" required autoCapitalize="none" /></label>
              <label>Password<input id="p_password" name="password" required minLength={6} /></label>
              <div><button className="btn-p" type="submit">Add parent</button></div>
            </form>
          </details>
        </div>
      </div>
      <div className="panel tbl-wrap">
        <h2>Everyone</h2>
        <table>
          <thead><tr><th>Name</th><th>Username</th><th>Role</th><th>Details</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td><b>{u.name}</b></td>
                <td className="num small">{u.username}</td>
                <td><span className="chip c-info">{u.role}</span></td>
                <td className="small">
                  {u.role === "student" && `${u.batch}${u.roll_no ? ` · roll ${u.roll_no}` : ""}${u.parent ? ` · parent: ${u.parent}` : " · no parent login"}`}
                  {u.role === "parent" && (u.children ? `Parent of ${u.children}` : "No child linked")}
                  {(u.role === "teacher" || u.role === "admin") && (u.subjects || "No subjects")}
                </td>
                <td>{u.status === "pending" ? <Link href="/admin/approvals" className="chip c-warn">Waiting approval</Link>
                  : u.status === "rejected" ? <span className="chip c-bad">Rejected</span>
                  : u.active ? <span className="chip c-good">Active</span> : <span className="chip c-bad">Turned off</span>}</td>
                <td><Link href={`/admin/people/${u.id}`}>Edit</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Shell>
  );
}
