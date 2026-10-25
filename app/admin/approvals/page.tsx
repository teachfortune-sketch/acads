import { requireRole } from "@/lib/auth";
import { sql } from "@/lib/db";
import { fmtDate } from "@/lib/util";
import { Shell } from "@/components/Shell";
import { Flash } from "@/components/Flash";
import { approveSignup, dismissReset, rejectSignup, setTempPassword } from "../quest-actions";

export default async function ApprovalsPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const s = await requireRole("admin");
  const sp = await searchParams;
  // A sign-up whose name and parent mobile match a student already on the roster is probably a second account.
  const pending = await sql`
    select u.id, u.name, u.username, u.created_at, b.name as batch, st.school, st.section, st.roll_no, st.parent_name, st.parent_mobile,
      (select string_agg(o.name || ' (' || o.username || ')', ', ') from students os join users o on o.id = os.user_id
        where o.id <> u.id and o.status = 'approved' and os.parent_mobile = st.parent_mobile and lower(o.name) = lower(u.name)) as duplicate
    from users u join students st on st.user_id = u.id join batches b on b.id = st.batch_id
    where u.status = 'pending' order by u.created_at`;
  const resets = await sql`
    select r.id, r.note, r.created_at, u.name, u.username, u.role, b.name as batch
    from reset_requests r join users u on u.id = r.user_id
    left join students st on st.user_id = u.id left join batches b on b.id = st.batch_id
    where r.handled_at is null order by r.created_at`;
  return (
    <Shell s={s} active="/admin/approvals">
      <div><h1>Approvals</h1><p className="muted">New student sign-ups and forgotten passwords wait here.</p></div>
      <Flash sp={sp} />
      <div className="panel stack">
        <h2>Sign-ups waiting <span className="chip c-warn">{pending.length}</span></h2>
        {pending.length ? (
          <ul className="list">
            {pending.map((p) => (
              <li key={p.id} style={{ flexWrap: "wrap" }}>
                <div style={{ flex: "1 1 280px" }}>
                  <b>{p.name}</b> <span className="muted small num">{p.username}</span>
                  <div className="small">{p.batch} · section {p.section} · roll no. {p.roll_no} · {p.school}</div>
                  <div className="small muted">Parent: {p.parent_name}, <span className="num">{p.parent_mobile}</span> · signed up {fmtDate(p.created_at)}</div>
                  {p.duplicate && <div className="err small" style={{ marginTop: 6 }}>Possible duplicate of {p.duplicate}: same name and parent mobile.</div>}
                </div>
                <div className="stack" style={{ gap: 8, flex: "0 1 260px" }}>
                  <form action={approveSignup}><input type="hidden" name="id" value={p.id} /><button className="btn-p" type="submit">Approve</button></form>
                  <details>
                    <summary className="small">Reject…</summary>
                    <form action={rejectSignup} className="inline-form" style={{ justifyContent: "flex-start" }}>
                      <input type="hidden" name="id" value={p.id} />
                      <input name="reason" aria-label="Reason" placeholder="Reason, e.g. not enrolled yet" required />
                      <button className="small btn-danger" type="submit">Reject</button>
                    </form>
                  </details>
                </div>
              </li>
            ))}
          </ul>
        ) : <p className="muted">No sign-ups waiting. New students can sign up from the login page.</p>}
      </div>
      <div className="panel stack">
        <h2>Password resets <span className="chip c-warn">{resets.length}</span></h2>
        {resets.length ? (
          <ul className="list">
            {resets.map((r) => (
              <li key={r.id} style={{ flexWrap: "wrap" }}>
                <div style={{ flex: "1 1 260px" }}>
                  <b>{r.name}</b> <span className="muted small num">{r.username}</span> <span className="chip c-info">{r.role}</span>
                  <div className="small muted">{r.batch ? `${r.batch} · ` : ""}asked {fmtDate(r.created_at)}{r.note ? ` · “${r.note}”` : ""}</div>
                </div>
                <div className="stack" style={{ gap: 6 }}>
                  <form action={setTempPassword} className="inline-form" style={{ justifyContent: "flex-start", marginTop: 0 }}>
                    <input type="hidden" name="request_id" value={r.id} />
                    <input name="password" aria-label="Temporary password" placeholder="Temporary password" minLength={6} required />
                    <button className="small btn-p" type="submit">Set</button>
                  </form>
                  <form action={dismissReset}><input type="hidden" name="request_id" value={r.id} /><button className="small" type="submit">Dismiss</button></form>
                </div>
              </li>
            ))}
          </ul>
        ) : <p className="muted">No password requests.</p>}
      </div>
    </Shell>
  );
}
