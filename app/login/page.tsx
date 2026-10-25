import Link from "next/link";
import { login } from "./actions";
import { Flash } from "@/components/Flash";

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  return (
    <main className="wrap">
      <div className="login-card stack">
        <div className="brand">
          <img src="/acads-mark.svg" alt="" width={46} height={46} />Acads Coaching
        </div>
        <div className="panel stack">
          <h1>Sign in</h1>
          <Flash sp={sp} />
          <form action={login} className="stack">
            <label>
              Username
              <input id="username" name="username" autoComplete="username" autoCapitalize="none" required />
            </label>
            <label>
              Password
              <input id="password" name="password" type="password" autoComplete="current-password" required />
            </label>
            <button className="btn-p" type="submit">Sign in</button>
          </form>
          <div className="row-actions small">
            <Link href="/login/forgot">Forgot password?</Link>
          </div>
        </div>
        <div className="panel row-actions" style={{ justifyContent: "space-between" }}>
          <span><b>New student?</b> <span className="muted">Create your account and wait for approval.</span></span>
          <Link href="/signup" className="btn small">Sign up</Link>
        </div>
      </div>
    </main>
  );
}
