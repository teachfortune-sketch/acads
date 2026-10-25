import { requireRole } from "@/lib/auth";
import { sql } from "@/lib/db";
import { getBatches } from "@/lib/queries";
import { fmtDate } from "@/lib/util";
import { Shell } from "@/components/Shell";
import { Flash } from "@/components/Flash";
import { deleteNotice, postNotice } from "../actions";

export default async function NoticesPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const s = await requireRole("admin");
  const sp = await searchParams;
  const batches = await getBatches();
  const students = await sql`
    select u.id, u.name, b.name as batch from students st join users u on u.id = st.user_id join batches b on b.id = st.batch_id
    where u.active order by b.sort, u.name`;
  const notices = await sql`
    select n.id, n.body, n.created_at, b.name as batch, u.name as student
    from notices n left join batches b on b.id = n.batch_id left join users u on u.id = n.student_id
    order by n.created_at desc limit 50`;
  return (
    <Shell s={s} active="/admin/notices">
      <div><h1>Notices and instructions</h1><p className="muted">Students and their parents see these on their home page.</p></div>
      <Flash sp={sp} />
      <div className="panel">
        <form action={postNotice} className="form">
          <label className="full">Send to
            <select id="target" name="target">
              <option value="all">Everyone</option>
              <optgroup label="One batch">{batches.map((b) => <option key={b.id} value={`batch:${b.id}`}>{b.name}</option>)}</optgroup>
              <optgroup label="One student (and their parent)">
                {students.map((st) => <option key={st.id} value={`student:${st.id}`}>{st.name} ({st.batch})</option>)}
              </optgroup>
            </select>
          </label>
          <label className="full">Message<textarea id="body" name="body" required placeholder="e.g. Test on fractions this Saturday. Revise exercise 2.3." /></label>
          <div><button className="btn-p" type="submit">Post notice</button></div>
        </form>
      </div>
      <div className="panel">
        <h2>Posted</h2>
        {notices.length ? (
          <ul className="list">
            {notices.map((n) => (
              <li key={n.id}>
                <div>
                  <div className="pre">{n.body}</div>
                  <div className="muted small">{fmtDate(n.created_at)} · to {n.student ?? n.batch ?? "everyone"}</div>
                </div>
                <form action={deleteNotice}>
                  <input type="hidden" name="id" value={n.id} />
                  <button className="small btn-danger" type="submit">Delete</button>
                </form>
              </li>
            ))}
          </ul>
        ) : <p className="muted">No notices yet.</p>}
      </div>
    </Shell>
  );
}
