import Link from "next/link";
import { Session } from "@/lib/auth";
import { sql } from "@/lib/db";
import { TopNav } from "@/components/TopNav";

const TABS: Record<Session["role"], [string, string][]> = {
  admin: [["/admin", "Students"], ["/admin/approvals", "Approvals"], ["/class", "Class mode"], ["/desk", "Desk"], ["/board", "Leaderboard"], ["/syllabus", "Syllabus"], ["/admin/reports", "Reports"], ["/admin/summaries", "Parent summary"], ["/admin/display", "TV display"],
    ["/admin/points", "Point rules"], ["/admin/enquiries", "Enquiries"], ["/admin/fees", "Fees"], ["/admin/people", "Logins"], ["/admin/notices", "Notices"],
    ["/teach/calendar", "Calendar"], ["/teach", "Classes"], ["/teach/exams", "Tests"], ["/teach/tasks", "Tasks"], ["/teach/sheets", "Sheets"], ["/teach/remarks", "Remarks"]],
  teacher: [["/class", "Class mode"], ["/board", "Leaderboard"], ["/syllabus", "Syllabus"], ["/teach/calendar", "Calendar"], ["/teach", "Classes"], ["/teach/exams", "Tests"],
    ["/teach/tasks", "Tasks"], ["/teach/sheets", "Sheets"], ["/teach/remarks", "Remarks"]],
  reception: [["/desk", "Desk"], ["/board", "Leaderboard"]],
  student: [["/me", "Home"], ["/board", "Leaderboard"], ["/planner", "Planner"], ["/syllabus", "Syllabus"], ["/me?tab=today", "Notes & tasks"], ["/me?tab=progress", "My progress"], ["/me?tab=classes", "All classes"]],
  parent: [["/parent", "Points"], ["/board", "Leaderboard"], ["/syllabus", "Syllabus"], ["/parent?tab=overview", "Overview"], ["/parent?tab=progress", "Progress"], ["/parent?tab=classes", "Classes"], ["/parent?tab=fees", "Fees"]],
};

export async function Shell({ s, active, child, children }: { s: Session; active: string; child?: number; children: React.ReactNode }) {
  // The admin sees how many sign-ups and password requests are waiting.
  const [waiting] = s.role === "admin"
    ? await sql`select (select count(*) from users where status = 'pending') + (select count(*) from reset_requests where handled_at is null) as n`
    : [{ n: 0 }];
  return (
    <>
      <header className="top">
        <div className="in">
          <Link href="/app" className="brand" style={{ textDecoration: "none" }}>
            <img src="/acads-mark.svg" alt="" width={36} height={36} />Acads
          </Link>
          <TopNav tabs={TABS[s.role]} active={active} child={child} name={s.name} role={s.role} waiting={Number(waiting.n)} />
        </div>
      </header>
      <main className="wrap">
        <div className="stack">{children}</div>
      </main>
    </>
  );
}
