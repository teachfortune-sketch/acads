import Link from "next/link";
import { jwtVerify } from "jose";
import { sql } from "@/lib/db";

// Reached right after signing up, or when a pending or rejected student signs in.
export default async function StatusPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  let uid: number | null = null;
  if (sp.t) {
    try {
      uid = Number((await jwtVerify(sp.t, new TextEncoder().encode(process.env.SESSION_SECRET))).payload.uid) || null;
    } catch {}
  }
  const [u] = uid
    ? await sql`select u.name, u.username, u.status, u.reject_reason, b.name as batch, st.school, st.section, st.roll_no, st.parent_name
        from users u join students st on st.user_id = u.id join batches b on b.id = st.batch_id where u.id = ${uid}`
    : [];
  return (
    <main className="wrap">
      <div className="login-card stack">
        <div className="panel stack">
          {sp.new ? (
            <>
              <span className="chip c-warn" style={{ alignSelf: "flex-start" }}>Waiting for approval</span>
              <h1>Account sent</h1>
              <p>Your account <b className="num">{sp.u}</b> is waiting for approval from the Acads office. Once it is approved, sign in with your username and password.</p>
            </>
          ) : !u ? (
            <>
              <h1>Sign in again</h1>
              <p className="muted">This page has expired.</p>
            </>
          ) : u.status === "rejected" ? (
            <>
              <span className="chip c-bad" style={{ alignSelf: "flex-start" }}>Not approved</span>
              <h1>Your account was not approved</h1>
              {u.reject_reason && <p><b>Reason:</b> {u.reject_reason}</p>}
              <p className="muted">Please speak to the Acads office.</p>
            </>
          ) : (
            <>
              <span className="chip c-warn" style={{ alignSelf: "flex-start" }}>Waiting for approval</span>
              <h1>Not approved yet</h1>
              <p>The Acads office hasn&apos;t approved your account yet. These are the details you sent:</p>
              <ul className="list small">
                <li><span>Name</span><b>{u.name}</b></li>
                <li><span>Class</span><b>{u.batch}, section {u.section}, roll no. {u.roll_no}</b></li>
                <li><span>School</span><b>{u.school}</b></li>
                <li><span>Parent</span><b>{u.parent_name}</b></li>
              </ul>
              <p className="muted small">If something is wrong, tell the office when you visit.</p>
            </>
          )}
          <Link href="/login" className="btn">Back to sign in</Link>
        </div>
      </div>
    </main>
  );
}
