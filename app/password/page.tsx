import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { changePassword } from "../login/actions";
import { Flash } from "@/components/Flash";

export default async function PasswordPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const s = await currentUser();
  if (!s) redirect("/logout");
  const sp = await searchParams;
  return (
    <main className="wrap">
      <div className="login-card stack">
        {!s.mustChange && <div><Link href="/app" className="btn small">← Back</Link></div>}
        <div className="panel stack">
          <h1>{s.mustChange ? "Choose a new password" : "Change password"}</h1>
          {s.mustChange && <p className="muted">You signed in with a temporary password. Choose your own to continue.</p>}
          <Flash sp={sp} />
          <form action={changePassword} className="stack">
            {!s.mustChange && <label>Current password<input id="current" name="current" type="password" autoComplete="current-password" required /></label>}
            <label>New password<input id="password" name="password" type="password" minLength={6} autoComplete="new-password" required /></label>
            <label>New password again<input id="confirm" name="confirm" type="password" minLength={6} autoComplete="new-password" required /></label>
            <button className="btn-p" type="submit">Save password</button>
          </form>
        </div>
      </div>
    </main>
  );
}
