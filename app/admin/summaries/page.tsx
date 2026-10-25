import Link from "next/link";
import { headers } from "next/headers";
import { requireRole } from "@/lib/auth";
import { getBatches } from "@/lib/queries";
import { addDays, mondayOf } from "@/lib/points";
import { weeklySummaries } from "@/lib/summary";
import { fmtDate, todayIST } from "@/lib/util";
import { Shell } from "@/components/Shell";
import { BatchChips } from "@/components/BatchChips";
import { SendSummary } from "@/components/SendSummary";

export default async function SummariesPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const s = await requireRole("admin");
  const sp = await searchParams;
  const h = await headers();
  const site = `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}`;
  const batches = await getBatches();
  const batch = batches.find((b) => b.id === Number(sp.batch)) ?? batches[0];
  const today = todayIST(), thisWeek = mondayOf(today), lastWeek = addDays(thisWeek, -7);
  // From Saturday the week's summary is ready; earlier in the week, last week's is the one to send.
  const weekday = new Date(today + "T00:00:00Z").getUTCDay();
  const week = sp.week === thisWeek || sp.week === lastWeek ? sp.week : weekday === 6 || weekday === 0 ? thisWeek : lastWeek;
  const list = batch ? await weeklySummaries(batch.id, batch.name, week, site) : [];
  const sent = list.filter((x) => x.sent).length, reachable = list.filter((x) => x.mobile).length;
  return (
    <Shell s={s} active="/admin/summaries">
      <div>
        <h1>Weekly parent summary</h1>
        <p className="muted">One short message per student with the week&apos;s XP, attendance, homework and discipline. Tap WhatsApp or SMS to send it from this phone; the message is filled in for you.</p>
      </div>
      <BatchChips batches={batches} current={batch?.id ?? null} base={`/admin/summaries?week=${week}`} />
      <div className="chips" aria-label="Week">
        <Link href={`/admin/summaries?batch=${batch?.id}&week=${lastWeek}`} aria-current={week === lastWeek}>Last week ({fmtDate(lastWeek)})</Link>
        <Link href={`/admin/summaries?batch=${batch?.id}&week=${thisWeek}`} aria-current={week === thisWeek}>This week so far</Link>
      </div>
      <p className="small"><b className="num">{sent}</b> of <b className="num">{list.length}</b> sent for {batch?.name}, week of {fmtDate(week)}.
        {reachable < list.length && <> {list.length - reachable} student{list.length - reachable === 1 ? " has" : "s have"} no parent mobile; add it on the student&apos;s login page.</>}</p>
      <div className="stack">
        {list.map((x) => (
          <div key={x.id} className="panel summary">
            <div className="row-actions" style={{ justifyContent: "space-between" }}>
              <div>
                <b>{x.name}</b>{" "}
                {x.sent ? <span className="chip c-good">Sent by {x.sent === "whatsapp" ? "WhatsApp" : "SMS"}</span> : <span className="chip c-warn">Not sent</span>}
                <div className="small muted">{x.parentName || "Parent"} · {x.mobile ? `+91 ${x.mobile}` : "no mobile on file"}</div>
              </div>
              {x.mobile && <SendSummary student={x.id} week={week} mobile={x.mobile} text={x.text} />}
            </div>
            <pre className="summary-text">{x.text}</pre>
          </div>
        ))}
        {!list.length && <p className="muted">No students in this class.</p>}
      </div>
    </Shell>
  );
}
