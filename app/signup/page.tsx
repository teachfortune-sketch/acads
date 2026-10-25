import Link from "next/link";
import type { Metadata } from "next";
import { getBatches } from "@/lib/queries";
import { Flash } from "@/components/Flash";
import { signUp } from "./actions";

export const metadata: Metadata = { title: "Sign up · Acads Coaching" };

export default async function SignUpPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const batches = await getBatches();
  return (
    <main className="wrap">
      <div className="stack" style={{ maxWidth: 640, margin: "0 auto" }}>
        <div><Link href="/login" className="btn small">← Sign in</Link></div>
        <div>
          <h1>Create your student account</h1>
          <p className="muted">Fill in everything below. Nothing opens until the Acads office approves your account, usually within a day.</p>
        </div>
        <Flash sp={sp} />
        <form action={signUp} className="stack">
          <fieldset className="panel form">
            <legend className="chip c-pink">Student</legend>
            <label className="full">Full name (as in school records)<input id="name" name="name" defaultValue={sp.name} required autoComplete="name" /></label>
            <label>Username<input id="username" name="username" defaultValue={sp.username} required autoCapitalize="none" autoComplete="username"
              pattern="[A-Za-z0-9_]{4,20}" title="4–20 letters, numbers or _" placeholder="e.g. aarav_09" /></label>
            <span className="muted small" style={{ alignSelf: "end" }}>Only for signing in. Leaderboards show your real name.</span>
            <label>Password<input id="password" name="password" type="password" minLength={6} required autoComplete="new-password" /></label>
            <label>Password again<input id="confirm" name="confirm" type="password" minLength={6} required autoComplete="new-password" /></label>
          </fieldset>
          <fieldset className="panel form">
            <legend className="chip c-info">School</legend>
            <label className="full">School name<input id="school" name="school" defaultValue={sp.school} required /></label>
            <label>Class
              <select id="batch_id" name="batch_id" defaultValue={sp.batch_id ?? ""} required>
                <option value="">Choose…</option>
                {batches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </label>
            <label>Section<input id="section" name="section" defaultValue={sp.section} required maxLength={10} placeholder="e.g. A" /></label>
            <label>Roll number<input id="roll_no" name="roll_no" defaultValue={sp.roll_no} required maxLength={10} inputMode="numeric" /></label>
          </fieldset>
          <fieldset className="panel form">
            <legend className="chip c-warn">Parent</legend>
            <label>Parent's name<input id="parent_name" name="parent_name" defaultValue={sp.parent_name} required /></label>
            <label>Parent's mobile<input id="parent_mobile" name="parent_mobile" defaultValue={sp.parent_mobile} required type="tel"
              inputMode="numeric" pattern="(\+91|0)?[6-9][0-9]{9}" title="10-digit Indian mobile number" placeholder="10-digit number" /></label>
            <div className="full checks" style={{ gridTemplateColumns: "1fr" }}>
              <label><input type="checkbox" id="consent" name="consent" required />
                I am the parent or guardian, and I agree that Acads may keep these details to track my child&apos;s progress.</label>
            </div>
          </fieldset>
          <div><button className="btn-p" type="submit">Send for approval</button></div>
        </form>
      </div>
    </main>
  );
}
