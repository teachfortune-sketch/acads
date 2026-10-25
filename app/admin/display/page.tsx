import { headers } from "next/headers";
import { requireRole } from "@/lib/auth";
import { sql } from "@/lib/db";
import { getBatches } from "@/lib/queries";
import { fmtDate } from "@/lib/util";
import { Shell } from "@/components/Shell";
import { Flash } from "@/components/Flash";
import { createDisplayLink, revokeDisplayLink } from "./actions";

export default async function DisplayLinksPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const s = await requireRole("admin");
  const sp = await searchParams;
  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}`;
  const [batches, links] = await Promise.all([
    getBatches(),
    sql`select d.id, d.token, d.label, d.created_at::date::text as made, b.name as batch from display_links d left join batches b on b.id = d.batch_id
      where d.revoked_at is null order by d.created_at desc`,
  ]);
  return (
    <Shell s={s} active="/admin/display">
      <div>
        <h1>TV display</h1>
        <p className="muted">A full-screen leaderboard with the week&apos;s top movers for a classroom or reception TV. It shows names, levels and XP only, never contact details.</p>
      </div>
      <Flash sp={sp} />
      <form action={createDisplayLink} className="panel form">
        <h2 className="full">Make a display link</h2>
        <label>Where is the TV?<input name="label" maxLength={60} placeholder="e.g. Reception TV" required /></label>
        <label>Show
          <select name="batch_id" defaultValue="">
            <option value="">Every class, changing every 20 seconds</option>
            {batches.map((b) => <option key={b.id} value={b.id}>{b.name} only</option>)}
          </select>
        </label>
        <div style={{ alignSelf: "end" }}><button type="submit" className="btn-p">Make link</button></div>
      </form>
      <div className="panel">
        <h2>Links in use</h2>
        {links.length ? (
          <ul className="list">
            {links.map((l) => {
              const url = `${origin}/tv/${l.token}`;
              return (
                <li key={l.id} style={{ flexWrap: "wrap" }}>
                  <div style={{ flex: "1 1 260px", minWidth: 0 }}>
                    <b>{l.label}</b> <span className="chip">{l.batch ?? "Every class"}</span>
                    <div className="small" style={{ overflowWrap: "anywhere" }}><a href={url} target="_blank" rel="noreferrer">{url}</a></div>
                    <div className="small muted">Made {fmtDate(l.made)}. Anyone with this link can see the leaderboard.</div>
                  </div>
                  <form action={revokeDisplayLink}><input type="hidden" name="id" value={l.id} /><button type="submit" className="small btn-danger">Turn off</button></form>
                </li>
              );
            })}
          </ul>
        ) : <p className="muted">No display links yet.</p>}
      </div>
    </Shell>
  );
}
