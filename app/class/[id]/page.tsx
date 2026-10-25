import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole, TEACHING } from "@/lib/auth";
import { sql } from "@/lib/db";
import { canTeach } from "@/lib/queries";
import { getRules, questLabel } from "@/lib/points";
import { booksFor } from "@/lib/books";
import { fmtDate } from "@/lib/util";
import { Shell } from "@/components/Shell";
import { Flash } from "@/components/Flash";
import { ClassMode, Tile } from "@/components/ClassMode";
import { postQuest, saveTopic } from "../actions";

// Next class day after the given date (Sunday is skipped).
function nextDay(day: string) {
  const d = new Date(day + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + (d.getUTCDay() === 6 ? 2 : 1));
  return d.toISOString().slice(0, 10);
}

export default async function ClassModePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string>> }) {
  const s = await requireRole(...TEACHING);
  const sp = await searchParams;
  const [l] = await sql`
    select l.id, l.batch_id, l.subject_id, l.held_on::text as day, l.topic, l.notes, b.name as batch, sub.name as subject
    from lectures l join batches b on b.id = l.batch_id join subjects sub on sub.id = l.subject_id where l.id = ${Number((await params).id) || 0}`;
  if (!l) notFound();
  if (!(await canTeach(s, l.subject_id))) notFound();
  const rules = await getRules();
  const [quest] = await sql`select id, book, chapter, exercise, questions, note, posted_by from quests where batch_id = ${l.batch_id} and due_on = ${l.day}`;
  const [next] = await sql`select q.*, q.due_on::text as due, u.name as poster, sub.name as subject from quests q join users u on u.id = q.posted_by
    join subjects sub on sub.id = q.subject_id where q.batch_id = ${l.batch_id} and q.due_on > ${l.day} order by q.due_on limit 1`;
  const rows = await sql`
    select u.id, u.name, st.roll_no, d.status, coalesce(d.arrived_at, '') as arrived,
      (select coalesce(sum(p.xp), 0)::int from points p where p.student_id = u.id and p.day = ${l.day}) as today_xp,
      c.done, c.stars, c.bonus
    from students st join users u on u.id = st.user_id and u.active and u.status = 'approved'
    left join day_attendance d on d.student_id = u.id and d.day = ${l.day}
    left join quest_checks c on c.quest_id = ${quest?.id ?? 0} and c.student_id = u.id
    where st.batch_id = ${l.batch_id}
    order by nullif(regexp_replace(st.roll_no, '\\D', '', 'g'), '')::int nulls last, u.name`;
  const tiles: Tile[] = rows.map((r) => ({
    id: r.id, name: r.name, roll: r.roll_no, status: r.status ?? null, arrived: r.arrived, todayXp: r.today_xp,
    hw: r.done == null ? null : { done: r.done, stars: r.stars, bonus: r.bonus },
  }));
  const recent = await sql`select id, student_id as student, reason, xp from points
    where staff_id = ${s.uid} and pillar in ('presence','discipline') and action <> 'clean_week' and created_at > now() - interval '10 minutes'
      and reversed_by_id is null and reverses_id is null order by id desc`;
  const books = booksFor(l.batch, l.subject);
  return (
    <Shell s={s} active="/class">
      <div className="row-actions"><Link href="/class" className="btn small">← Class mode</Link></div>
      <div>
        <h1>{l.batch} · {l.subject}</h1>
        <p className="muted">{fmtDate(l.day)} · {l.topic}</p>
      </div>
      <Flash sp={sp} />
      <ClassMode day={l.day} tiles={tiles} isAdmin={s.role === "admin"} quest={quest ? { id: quest.id, label: questLabel(quest) || quest.note } : null}
        recent={recent.map((r) => ({ id: r.id, student: r.student, reason: r.reason, xp: r.xp }))}
        values={{
          plus: Number(rules.presence_plus), minus: Number(rules.presence_minus), hwBonusMax: Number(rules.hw_bonus_max), otherMax: Number(rules.disc_other_max),
          disc: { uniform: Number(rules.disc_uniform), phone: Number(rules.disc_phone), disruption: Number(rules.disc_disruption), misbehaviour: Number(rules.disc_misbehaviour) },
        }} />
      <div className="grid">
        <form action={postQuest} className="panel form" id="quest">
          <input type="hidden" name="id" value={l.id} />
          <h2 className="full">{next ? "Next homework" : "Post tomorrow's homework"}</h2>
          {next && (
            <p className="full small">
              <span className="chip c-info">Due {fmtDate(next.due)}</span> <b>{next.subject}:</b> {questLabel(next)}{next.note ? `. ${next.note}` : ""}
              <span className="muted"> · set by {next.poster}. Posting for the same day replaces it.</span>
            </p>
          )}
          <label>Due on<input id="due_on" name="due_on" type="date" defaultValue={next?.due ?? nextDay(l.day)} min={nextDay(l.day)} required /></label>
          <label>Book
            <input id="book" name="book" list="books" defaultValue={books[0]} required />
            <datalist id="books">{books.map((b) => <option key={b} value={b} />)}</datalist>
          </label>
          <label>Chapter<input id="chapter" name="chapter" placeholder="e.g. 4 · Linear Equations" /></label>
          <label>Exercise or sheet no.<input id="exercise" name="exercise" placeholder="e.g. 4.2" /></label>
          <label>Questions<input id="questions" name="questions" placeholder="e.g. 1–10" /></label>
          <label className="full">Note (optional)<input id="note" name="note" placeholder="e.g. Show all working in the homework notebook" /></label>
          <div><button className="btn-p" type="submit">Post homework</button></div>
        </form>
        <form action={saveTopic} className="panel form" style={{ gridTemplateColumns: "1fr" }}>
          <input type="hidden" name="id" value={l.id} />
          <h2>What you taught</h2>
          <label>Topic<input id="topic" name="topic" defaultValue={l.topic} required /></label>
          <label>Notes for absent students<textarea id="notes" name="notes" defaultValue={l.notes} placeholder="Key points, page numbers, examples solved" /></label>
          <div className="row-actions">
            <button type="submit">Save topic and notes</button>
            <Link href={`/teach/lectures/${l.id}`} className="small">Open full class log</Link>
          </div>
        </form>
      </div>
    </Shell>
  );
}
