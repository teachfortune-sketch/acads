import Link from "next/link";
import { requestReset } from "../actions";
import { Flash } from "@/components/Flash";

export default async function ForgotPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  return (
    <main className="wrap">
      <div className="login-card stack">
        <div><Link href="/login" className="btn small">← Sign in</Link></div>
        <div className="panel stack">
          <h1>Forgot password</h1>
          <p className="muted">Send a request to the office. They will give you a temporary password, and you'll choose a new one when you sign in.</p>
          <Flash sp={sp} />
          <form action={requestReset} className="stack">
            <label>Your username<input id="username" name="username" autoCapitalize="none" autoComplete="username" required /></label>
            <label>Anything the office should know? (optional)<input id="note" name="note" maxLength={200} placeholder="e.g. Class 9, roll no. 12" /></label>
            <button className="btn-p" type="submit">Send request</button>
          </form>
        </div>
      </div>
    </main>
  );
}
