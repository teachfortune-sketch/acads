import Link from "next/link";
import { Session } from "@/lib/auth";

const TABS: Record<Session["role"], [string, string][]> = {
  admin: [["/admin", "Students"], ["/admin/enquiries", "Enquiries"], ["/admin/people", "Logins"], ["/admin/notices", "Notices"], ["/teach/calendar", "Calendar"], ["/teach", "Classes"], ["/teach/exams", "Tests"], ["/teach/tasks", "Tasks"], ["/teach/sheets", "Sheets"], ["/teach/remarks", "Remarks"]],
  teacher: [["/teach/calendar", "Calendar"], ["/teach", "Classes"], ["/teach/exams", "Tests"], ["/teach/tasks", "Tasks"], ["/teach/sheets", "Sheets"], ["/teach/remarks", "Remarks"]],
  student: [["/me", "Today"], ["/me?tab=progress", "My progress"], ["/me?tab=classes", "All classes"]],
  parent: [["/parent", "Overview"], ["/parent?tab=progress", "Progress"], ["/parent?tab=classes", "Classes"]],
};

// child keeps a parent's chosen child selected when they switch tabs.
export function Shell({ s, active, child, children }: { s: Session; active: string; child?: number; children: React.ReactNode }) {
  const withChild = (href: string) => (child ? `${href}${href.includes("?") ? "&" : "?"}child=${child}` : href);
  return (
    <>
      <header className="top">
        <div className="in">
          <Link href="/app" className="brand" style={{ textDecoration: "none" }}>
            <i></i>Acads
          </Link>
          <nav className="tabs">
            {TABS[s.role].map(([href, label]) => (
              <Link key={href} href={withChild(href)} className="tab" aria-current={active === href}>
                {label}
              </Link>
            ))}
          </nav>
          <div className="who">
            <span>
              {s.name} · <span className="chip c-info">{s.role}</span>
            </span>
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
