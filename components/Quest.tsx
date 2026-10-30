import Link from "next/link";
import { sql } from "@/lib/db";
import { StudentInfo } from "@/lib/queries";
import {
  attendanceStreak, batchBoard, BoardRow, FeedRow, getRules, homeworkStreak, nextStep, PILLARS, Pillar, pillarTotals, questLabel, routineStreak,
  studentBadges, studentFeed,
} from "@/lib/points";
import { classSyllabus } from "@/lib/syllabus";
import { fmtDate, todayIST, withDeadline } from "@/lib/util";
import { AutoRefresh } from "./AutoRefresh";

const pillarOf = (k: Pillar) => PILLARS.find((p) => p.key === k)!;
const signed = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : "0");

function Movement({ r }: { r: BoardRow }) {
  const d = r.rank_before - r.rank;
  if (!d) return <span className="muted small num">–</span>;
  return <span className={`move ${d > 0 ? "up" : "down"}`}>{d > 0 ? "▲" : "▼"} {Math.abs(d)}</span>;
}

// Five-pillar stacked bar of positive XP, with discipline shown as a separate minus segment.
export function PillarBar({ p }: { p: Record<Pillar, number> }) {
  const parts = PILLARS.map((x) => ({ ...x, v: Math.max(0, p[x.key]) })).filter((x) => x.v > 0);
  const total = parts.reduce((a, x) => a + x.v, 0);
  return (
    <div className="pbar" role="img" aria-label={PILLARS.map((x) => `${x.label} ${p[x.key]}`).join(", ")}>
      {total ? parts.map((x) => <span key={x.key} style={{ width: `${(x.v / total) * 100}%`, background: x.color }} />) : <span style={{ width: "100%" }} />}
    </div>
  );
}

export function PillarLegend() {
  return (
    <div className="legend small">
      {PILLARS.map((p) => <span key={p.key}><i style={{ background: p.color }} />{p.label}</span>)}
    </div>
  );
}

export async function QuestHome({ st, viewer }: { st: StudentInfo; viewer: "student" | "parent" | "staff" }) {
  const today = todayIST();
  const [board, feed, pillars, hwStreak, attStreak, rtStreak, rules, syllabus, quests] = await Promise.all([
    withDeadline("board", batchBoard(st.batch_id)), withDeadline("feed", studentFeed(st.id, 30)), withDeadline("pillars", pillarTotals(st.id)),
    withDeadline("hw streak", homeworkStreak(sql, st.id)), withDeadline("attendance streak", attendanceStreak(sql, st.id)),
    withDeadline("routine streak", routineStreak(sql, st.id)), withDeadline("rules", getRules()),
    withDeadline("syllabus", classSyllabus(st.batch_id, st.batch)),
    withDeadline("quests", sql`select q.*, q.due_on::text as due, sub.name as subject, u.name as poster, c.done, c.stars
      from quests q join subjects sub on sub.id = q.subject_id join users u on u.id = q.posted_by
      left join quest_checks c on c.quest_id = q.id and c.student_id = ${st.id}
      where q.batch_id = ${st.batch_id} and q.due_on >= ${today} order by q.due_on limit 3`.then((r) => r)),
  ]);
  const me = board.find((r) => r.id === st.id);
  const badges = await withDeadline("badges", studentBadges(st.id, me?.earned ?? 0));
  const subjects = [...new Map(syllabus.map((c) => [c.subject_id, c.subject])).entries()].map(([id, name]) => {
    const all = syllabus.filter((c) => c.subject_id === id);
    return { id, name, total: all.length, taught: all.filter((c) => c.taught).length };
  });
  const childQ = viewer === "parent" ? `?child=${st.id}` : viewer === "staff" ? `?batch=${st.batch_id}` : "";
  const you = viewer === "student";
  const first = st.name.split(" ")[0];
  const lvl = me ? me.level : 1;
  const intoLevel = me ? me.earned - (lvl - 1) * 100 : 0;
  const ahead = me && me.rank > 1 ? board[me.rank - 2] : null;
  const gap = ahead && me ? ahead.net - me.net + 1 : 0;
  const nextQuest = quests.find((q) => q.due > today) ?? quests[0];
  return (
    <>
      <AutoRefresh seconds={10} />
      <div className="qhome">
        <div className="qcard qhw">
          <span className="chip c-info">{nextQuest ? (nextQuest.due === today ? "Due today" : `Due ${fmtDate(nextQuest.due)}`) : "Homework"}</span>
          {nextQuest ? (
            <>
              <h2>{nextQuest.subject}</h2>
              <p className="qhw-ref">{questLabel(nextQuest) || nextQuest.note}</p>
              {nextQuest.note && questLabel(nextQuest) && <p className="small">{nextQuest.note}</p>}
              <p className="muted small">Set by {nextQuest.poster}. Done +{rules.hw_done}, each star +{rules.hw_star} when your teacher checks it.</p>
            </>
          ) : (
            <>
              <h2>No homework set yet</h2>
              <p className="muted small">When a teacher posts tomorrow&apos;s homework it shows here.</p>
            </>
          )}
        </div>
        <div className="qcard qplayer">
          <div className="row-actions" style={{ justifyContent: "space-between" }}>
            <span className="chip">Level {lvl} · {me?.title ?? "Rookie"}</span>
            {me && <span className="chip c-pink">#{me.rank} of {board.length}</span>}
          </div>
          <div className="qxp"><span className="big num">{me?.net ?? 0}</span> <span className="small">net XP</span></div>
          <div className="xpbar" aria-label={`${intoLevel} of 100 XP to level ${lvl + 1}`}><span style={{ width: `${Math.min(100, intoLevel)}%` }} /></div>
          <p className="small"><b className="num">{100 - intoLevel}</b> XP to level {lvl + 1}</p>
          <p className="qnudge">
            {!me || !board.length ? "Points start with your first class."
              : me.rank === 1 ? (board[1] ? `${you ? "You lead" : `${first} leads`} by ${me.net - board[1].net} XP. Keep it up!` : "Top of the class.")
              : `Earn ${gap} XP to pass ${ahead!.name.split(" ")[0]} and reach #${me.rank - 1}.`}
          </p>
          {me && <p className="small">Today: <b className="num">{signed(me.today)}</b> · rank today <Movement r={me} /></p>}
        </div>
      </div>
      <div className="grid streaks">
        {([["Homework streak", hwStreak, "homework done on every homework day"], ["Attendance streak", attStreak, "on time every class day"],
          ["Routine streak", rtStreak, "days you followed your own study routine"]] as const).map(([label, n, what]) => {
          const step = nextStep(n);
          return (
            <div className="panel streak" key={label}>
              <div className="muted small">{label}</div>
              <div className="big num">{n} <span className="small">day{n === 1 ? "" : "s"}</span></div>
              <div className="small">{step ? <>{step - n} more for the {step}-day bonus (+{rules[`streak_${step}` as "streak_5"]})</> : "Longest bonus reached!"}</div>
              <div className="muted small what">{what}</div>
            </div>
          );
        })}
      </div>
      <div className="panel">
        <div className="row-actions" style={{ justifyContent: "space-between" }}>
          <h2>Where {you ? "your" : `${first}'s`} points come from</h2>
          <Link href={`/board${childQ}`} className="btn small">Leaderboard</Link>
        </div>
        <div className="pillars">
          {PILLARS.map((p) => (
            <div key={p.key} className="pillar">
              <span className={`chip ${p.chip}`}>{p.label}</span>
              <span className="num"><b>{signed(pillars[p.key].week)}</b> <span className="muted small">this week</span></span>
              <span className="num small">{signed(pillars[p.key].term)} <span className="muted">this term</span></span>
            </div>
          ))}
        </div>
      </div>
      <div className="panel">
        <div className="row-actions" style={{ justifyContent: "space-between" }}>
          <h2>Badges</h2>
          <span className="small num">{badges.filter((b) => b.earned).length} / {badges.length} unlocked</span>
        </div>
        <div className="badges">
          {badges.map((b) => (
            <div key={b.key} className={`badge${b.earned ? "" : " locked"}`}>
              <span className="seal" style={b.earned ? { background: b.color } : undefined}>{b.seal}</span>
              <b>{b.name}</b>
              <span className="small muted desc">{b.desc}</span>
              {!b.earned && <span className="prog" role="img" aria-label={`${b.have} of ${b.need}`}><span style={{ width: `${(b.have / b.need) * 100}%` }} /></span>}
              <span className="small num">{b.earned ? "Unlocked" : `${b.have} / ${b.need}`}</span>
            </div>
          ))}
        </div>
      </div>
      {subjects.length > 0 && (
        <div className="panel">
          <div className="row-actions" style={{ justifyContent: "space-between" }}>
            <h2>Syllabus taught</h2>
            <div className="row-actions">
              {viewer === "student" && <Link href="/planner" className="btn small">Planner</Link>}
              <Link href={`/syllabus${childQ}`} className="btn small">Syllabus</Link>
            </div>
          </div>
          <div className="sylbars">
            {subjects.map((x) => (
              <Link key={x.id} href={`/syllabus${childQ}${childQ ? "&" : "?"}subject=${x.id}`} className="sylbar">
                <span>{x.name}</span>
                <span className="xpbar thin" aria-hidden><span style={{ width: `${(x.taught / x.total) * 100}%` }} /></span>
                <span className="num small">{x.taught}/{x.total}</span>
              </Link>
            ))}
          </div>
        </div>
      )}
      <Feed feed={feed} />
    </>
  );
}

// The newest few show straight away; older ones fold away so the list doesn't run the length of a phone screen.
const FEED_FIRST = 8;

export function Feed({ feed, reverse }: { feed: FeedRow[]; reverse?: (f: FeedRow) => React.ReactNode }) {
  const row = (f: FeedRow) => (
    <li key={f.id} className={f.reversed ? "struck" : ""}>
      <span className={`xp num ${f.xp > 0 ? "pos" : f.xp < 0 ? "neg" : ""}`}>{signed(f.xp)}</span>
      <div style={{ flex: 1 }}>
        <div><span className={`chip ${pillarOf(f.pillar).chip}`}>{pillarOf(f.pillar).label}</span> {f.reason}{f.reversed ? " (reversed)" : ""}</div>
        {f.note && <div className="small">“{f.note}”</div>}
        <div className="muted small">{f.staff ?? "Acads"} · {fmtDate(f.day)} · {new Date(f.created_at).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "numeric", minute: "2-digit" })}</div>
      </div>
      {reverse && !f.reversed && !f.is_reversal && reverse(f)}
    </li>
  );
  return (
    <div className="panel" id="points">
      <h2>Every point change</h2>
      {feed.length ? (
        <>
          <ul className="list feed">{feed.slice(0, FEED_FIRST).map(row)}</ul>
          {feed.length > FEED_FIRST && (
            <details className="more">
              <summary>Show {feed.length - FEED_FIRST} older</summary>
              <ul className="list feed">{feed.slice(FEED_FIRST).map(row)}</ul>
            </details>
          )}
        </>
      ) : <p className="muted">No points yet. They appear here as teachers and reception record them.</p>}
    </div>
  );
}

export function Leaderboard({ board, me }: { board: BoardRow[]; me?: number }) {
  if (!board.length) return <div className="panel"><p className="muted">No students in this batch yet.</p></div>;
  const podium = [board[1], board[0], board[2]].filter(Boolean);
  return (
    <>
      <div className="podium">
        {podium.map((r) => (
          <div key={r.id} className={`pod p${r.rank}${r.id === me ? " me" : ""}`}>
            <span className="pod-rank num">#{r.rank}</span>
            <b>{r.name}</b>
            <span className="num">{r.net} XP</span>
            <span className="small">L{r.level} · {r.title}</span>
          </div>
        ))}
      </div>
      <div className="panel tbl-wrap">
        <table className="board">
          <thead><tr><th>#</th><th>Student</th><th>Level</th><th>Net XP</th><th style={{ minWidth: 140 }}>Five pillars</th><th>Today</th></tr></thead>
          <tbody>
            {board.map((r) => (
              <tr key={r.id} className={r.id === me ? "me" : ""}>
                <td className="num"><b>{r.rank}</b></td>
                <td><b>{r.name}</b></td>
                <td className="small">L{r.level} · {r.title}</td>
                <td className="num"><b>{r.net}</b></td>
                <td><PillarBar p={r.pillars} /></td>
                <td><Movement r={r} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        <PillarLegend />
      </div>
    </>
  );
}

