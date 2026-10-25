import { notFound } from "next/navigation";
import { sql } from "@/lib/db";
import { getBatches } from "@/lib/queries";
import { batchBoard, mondayOf, PILLARS } from "@/lib/points";
import { todayIST } from "@/lib/util";
import { PillarBar } from "@/components/Quest";
import { AutoRefresh } from "@/components/AutoRefresh";
import { Rotate } from "@/components/Rotate";

export const metadata = { title: "Acads leaderboard", robots: { index: false } };

// Full-screen leaderboard for a classroom or reception TV. Opened with a private link the admin makes; shows names and XP only.
export default async function TvPage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ i?: string }> }) {
  const { token } = await params;
  const [link] = await sql`select id, label, batch_id from display_links where token = ${token} and revoked_at is null`;
  if (!link) notFound();
  // A rotating screen skips classes with no students yet.
  const filled = await sql`select distinct st.batch_id from students st join users u on u.id = st.user_id and u.active and u.status = 'approved'`;
  const all = (await getBatches()).filter((b) => (link.batch_id ? b.id === link.batch_id : filled.some((f) => f.batch_id === b.id)));
  const batches = all.length || link.batch_id ? all : (await getBatches()).slice(0, 1);
  if (!batches.length) notFound();
  const i = Math.max(0, Number((await searchParams).i) || 0) % batches.length;
  const batch = batches[i];
  const board = await batchBoard(batch.id);
  const monday = mondayOf(todayIST());
  const week = await sql<{ id: number; name: string; xp: number }[]>`
    select u.id, u.name, coalesce(sum(p.xp), 0)::int as xp
    from students st join users u on u.id = st.user_id and u.active and u.status = 'approved'
    join points p on p.student_id = u.id and p.day >= ${monday}
    where st.batch_id = ${batch.id} group by u.id, u.name having sum(p.xp) > 0 order by xp desc, u.name limit 5`;
  const climbers = board.filter((r) => r.rank_before > r.rank).sort((a, b) => b.rank_before - b.rank - (a.rank_before - a.rank)).slice(0, 5);
  const top = board.slice(0, 10);
  const podium = [board[1], board[0], board[2]].filter(Boolean);
  const rotating = batches.length > 1;
  return (
    <main className="tv">
      {rotating ? <Rotate next={`/tv/${token}?i=${(i + 1) % batches.length}`} seconds={20} /> : <AutoRefresh seconds={15} />}
      <header className="tv-head">
        <div className="tv-brand"><img src="/acads-mark.svg" alt="" width={56} height={56} />Acads</div>
        <h1>{batch.name} leaderboard</h1>
        <span className="tv-live"><b /> Live</span>
      </header>
      <div className="tv-body">
        <section aria-label="Top of the class">
          <div className="podium tv-podium">
            {podium.map((r) => (
              <div key={r.id} className={`pod p${r.rank}`}>
                <span className="pod-rank num">#{r.rank}</span>
                <b>{r.name}</b>
                <span className="num">{r.net} XP</span>
                <span>L{r.level} · {r.title}</span>
              </div>
            ))}
          </div>
          <ol className="tv-list">
            {top.map((r) => (
              <li key={r.id}>
                <span className="tv-rank num">{r.rank}</span>
                <span className="tv-name"><b>{r.name}</b><small>L{r.level} · {r.title}</small></span>
                <PillarBar p={r.pillars} />
                <span className="tv-xp num">{r.net}</span>
              </li>
            ))}
            {!top.length && <li className="tv-empty muted">No students in this class yet.</li>}
          </ol>
          <div className="legend">{PILLARS.map((p) => <span key={p.key}><i style={{ background: p.color }} />{p.label}</span>)}</div>
        </section>
        <aside className="tv-side">
          <div className="tv-card">
            <h2>Top movers this week</h2>
            {week.length ? (
              <ol>{week.map((r) => <li key={r.id}><span>{r.name}</span><b className="num">+{r.xp}</b></li>)}</ol>
            ) : <p>Points earned since Monday show here.</p>}
          </div>
          <div className="tv-card">
            <h2>Climbing today</h2>
            {climbers.length ? (
              <ol>{climbers.map((r) => <li key={r.id}><span>{r.name}</span><b className="num">▲ {r.rank_before - r.rank}</b></li>)}</ol>
            ) : <p>No rank changes yet today.</p>}
          </div>
          {rotating && <p className="tv-foot">Showing class {i + 1} of {batches.length}. Next class in 20 seconds.</p>}
        </aside>
      </div>
    </main>
  );
}
