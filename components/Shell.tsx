import Link from "next/link";
import { Session } from "@/lib/auth";
import { sql } from "@/lib/db";

const TABS: Record<Session["role"], [string, string][]> = {
  admin: [["/admin", "Students"], ["/admin/approvals", "Approvals"], ["/class", "Class mode"], ["/desk", "Desk"], ["/board", "Leaderboard"],
    ["/admin/points", "Point rules"], ["/admin/enquiries", "Enquiries"], ["/admin/fees", "Fees"], ["/admin/people", "Logins"], ["/admin/notices", "Notices"],
    ["/teach/calendar", "Calendar"], ["/teach", "Classes"], ["/teach/exams", "Tests"], ["/teach/tasks", "Tasks"], ["/teach/sheets", "Sheets"], ["/teach/remarks", "Remarks"]],
  teacher: [["/class", "Class mode"], ["/board", "Leaderboard"], ["/teach/calendar", "Calendar"], ["/teach", "Classes"], ["/teach/exams", "Tests"],
    ["/teach/tasks", "Tasks"], ["/teach/sheets", "Sheets"], ["/teach/remarks", "Remarks"]],
  reception: [["/desk", "Desk"], ["/board", "Leaderboard"]],
  student: [["/me", "Home"], ["/board", "Leaderboard"], ["/me?tab=today", "Notes & tasks"], ["/me?tab=progress", "My progress"], ["/me?tab=classes", "All classes"]],
  parent: [["/parent", "Points"], ["/board", "Leaderboard"], ["/parent?tab=overview", "Overview"], ["/parent?tab=progress", "Progress"], ["/parent?tab=classes", "Classes"], ["/parent?tab=fees", "Fees"]],
};

// child keeps a parent's chosen child selected when they switch tabs.
export async function Shell({ s, active, child, children }: { s: Session; active: string; child?: number; children: React.ReactNode }) {
  // The admin sees how many sign-ups and password requests are waiting.
  const [waiting] = s.role === "admin"
    ? await sql`select (select count(*) from users where status = 'pending') + (select count(*) from reset_requests where handled_at is null) as n`
    : [{ n: 0 }];
  const withChild = (href: string) => (child ? `${href}${href.includes("?") ? "&" : "?"}child=${child}` : href);
  return (
    <>
      <header className="top">
        <div className="in">
          <Link href="/app" className="brand" style={{ textDecoration: "none" }}>
            <img src="/acads-mark.png" alt="" width={36} height={36} />Acads
          </Link>
          <nav className="tabs">
            {TABS[s.role].map(([href, label]) => (
              <Link key={href} href={withChild(href)} className="tab" aria-current={active === href}>
                {label}
                {href === "/admin/approvals" && Number(waiting.n) > 0 && <span className="count num">{waiting.n}</span>}
              </Link>
            ))}
          </nav>
          <div className="who">
            <span>
              {s.name} · <span className="chip c-info">{s.role}</span>
            </span>
            <Link href="/password" className="small">Password</Link>
            <form action="/logout" method="post">
              <button className="small" type="submit">Sign out</button>
            </form>
          </div>
        </div>
      </header>
      <main className="wrap">
        <div className="stack">{children}</div>
      </main>
    </>
  );
}
