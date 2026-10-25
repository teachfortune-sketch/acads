import { login } from "./actions";
import { Flash } from "@/components/Flash";

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  return (
    <main className="wrap">
      <div className="login-card stack">
        <div className="brand">
          <img src="/acads-mark.png" alt="" width={46} height={46} />Acads Coaching
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
          <p className="muted small">Forgot your password? Ask Rahul to reset it.</p>
        </div>
      </div>
    </main>
  );
}
