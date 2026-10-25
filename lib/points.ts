import type postgres from "postgres";
import { sql } from "./db";
import { todayIST } from "./util";

// ── Point rules ─────────────────────────────────────────────────────────────
// Defaults from the Questboard PRD. The admin can change any of them on Point rules.
// Deductions are stored as positive numbers and subtracted.
export const RULES = {
  hw_done: { label: "Homework done", def: 10, group: "Homework" },
  hw_star: { label: "Each star (up to 3)", def: 5, group: "Homework" },
  hw_bonus_max: { label: "Excellent-work bonus, most allowed", def: 20, group: "Homework" },
  att_on_time: { label: "Present on time", def: 10, group: "Attendance" },
  att_late: { label: "Late (instead of on time)", def: 5, group: "Attendance" },
  late_cutoff: { label: "Late after (time)", def: "09:00", group: "Attendance" },
  absent_cutoff: { label: "Counts as absent after (time)", def: "09:30", group: "Attendance" },
  presence_plus: { label: "Attentive, answered, good question, helped", def: 5, group: "Class presence" },
  presence_minus: { label: "Inattentive (deduction)", def: 5, group: "Class presence" },
  presence_cap_day: { label: "Most presence XP in one day", def: 20, group: "Class presence" },
  disc_uniform: { label: "Uniform (deduction)", def: 5, group: "Discipline" },
  disc_phone: { label: "Phone found (deduction)", def: 10, group: "Discipline" },
  disc_disruption: { label: "Disruption (deduction)", def: 10, group: "Discipline" },
  disc_misbehaviour: { label: "Misbehaviour (deduction)", def: 25, group: "Discipline" },
  disc_other_max: { label: "Other: largest deduction allowed", def: 25, group: "Discipline" },
  ss_verified: { label: "Self-study task verified", def: 10, group: "Self-study" },
  ss_great: { label: "Great plan", def: 15, group: "Self-study" },
  ss_cap_week: { label: "Verified tasks counted per subject per week", def: 3, group: "Self-study" },
  streak_5: { label: "5-day streak bonus", def: 25, group: "Streaks" },
  streak_10: { label: "10-day streak bonus", def: 50, group: "Streaks" },
  streak_30: { label: "30-day streak bonus", def: 150, group: "Streaks" },
  term_start: { label: "Leaderboard counts from (date)", def: "2026-04-01", group: "Leaderboard" },
} as const;
export type RuleKey = keyof typeof RULES;
export type Rules = { [K in RuleKey]: (typeof RULES)[K]["def"] extends number ? number : string };

export async function getRules(db: Db = sql): Promise<Rules> {
  const rows = await db`select key, value from point_rules`;
  const saved = Object.fromEntries(rows.map((r) => [r.key, r.value as string]));
  const out: Record<string, number | string> = {};
  for (const [k, r] of Object.entries(RULES)) {
    const v = saved[k];
    out[k] = typeof r.def === "number" ? (v != null && Number.isFinite(Number(v)) ? Number(v) : r.def) : (v || r.def);
  }
  return out as Rules;
}

// ── Labels ──────────────────────────────────────────────────────────────────
export const PILLARS = [
  { key: "homework", label: "Homework", chip: "c-info", color: "var(--sky)" },
  { key: "attendance", label: "Attendance", chip: "c-good", color: "var(--mint)" },
  { key: "presence", label: "Class presence", chip: "c-warn", color: "var(--yellow)" },
  { key: "discipline", label: "Discipline", chip: "c-bad", color: "var(--coral)" },
  { key: "selfstudy", label: "Self-study", chip: "c-pink", color: "var(--pink)" },
] as const;
export type Pillar = (typeof PILLARS)[number]["key"];

export const PRESENCE = {
  attentive: "Attentive in class",
  answered: "Answered a question",
  good_question: "Asked a good question",
  helped: "Helped a classmate",
  inattentive: "Inattentive or distracted",
} as const;
export type PresenceAction = keyof typeof PRESENCE;

export const DISCIPLINE = {
  uniform: "Uniform",
  phone: "Phone found",
  disruption: "Disruption",
  misbehaviour: "Misbehaviour",
  other: "Other",
} as const;
export type DisciplineReason = keyof typeof DISCIPLINE;

export const TITLES: [number, string][] = [[9, "Legend"], [7, "Ace"], [5, "Scholar"], [3, "Explorer"], [1, "Rookie"]];
export const levelOf = (earned: number) => Math.floor(Math.max(0, earned) / 100) + 1;
export const titleOf = (lvl: number) => TITLES.find(([min]) => lvl >= min)![1];

// ── Writing points ──────────────────────────────────────────────────────────
type Db = postgres.Sql | postgres.TransactionSql;
export type Actor = { uid: number; role: string };

export class PointsError extends Error {}

export function nowIST() {
  return new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date());
}
export function istParts(at: Date) {
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(at);
  const time = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hour12: false }).format(at);
  return { day, time };
}

type NewPoint = {
  student: number; pillar: Pillar; action: string; xp: number; reason: string; note?: string;
  staff: number; quest?: number | null; day: string; at?: Date;
};

async function addPoint(db: Db, p: NewPoint) {
  const [row] = await db`
    insert into points (student_id, pillar, action, xp, reason, note, staff_id, quest_id, day, created_at)
    values (${p.student}, ${p.pillar}, ${p.action}, ${p.xp}, ${p.reason}, ${p.note ?? ""}, ${p.staff}, ${p.quest ?? null}, ${p.day}, ${p.at ?? new Date()})
    returning id`;
  return row.id as number;
}

async function reverseRow(db: Db, id: number, staff: number, note: string) {
  const [orig] = await db`select * from points where id = ${id} and reversed_by_id is null and reverses_id is null for update`;
  if (!orig) return false;
  const [rev] = await db`
    insert into points (student_id, pillar, action, xp, reason, note, staff_id, quest_id, day, reverses_id)
    values (${orig.student_id}, ${orig.pillar}, 'reversal', ${-orig.xp}, ${"Reversed: " + orig.reason}, ${note}, ${staff}, ${orig.quest_id}, ${orig.day}, ${orig.id})
    returning id`;
  await db`update points set reversed_by_id = ${rev.id} where id = ${orig.id}`;
  return true;
}

// Entries that still stand (not reversed and not themselves a reversal).
const standing = (db: Db) => db`reversed_by_id is null and reverses_id is null`;

// Staff can undo their own presence, discipline or self-study entry for 10 minutes. Admins can reverse anything, with a note.
export async function undoPoint(db: Db, id: number, actor: Actor, note: string) {
  const [p] = await db`select staff_id, pillar, created_at from points where id = ${id}`;
  if (!p) throw new PointsError("That entry no longer exists.");
  if (actor.role !== "admin") {
    const fresh = Date.now() - new Date(p.created_at).getTime() < 10 * 60 * 1000;
    if (p.staff_id !== actor.uid || !fresh || !["presence", "discipline", "selfstudy"].includes(p.pillar))
      throw new PointsError("You can undo only your own entries, within 10 minutes. Ask an admin to reverse older ones.");
  } else if (!note) throw new PointsError("Write why you are reversing this entry.");
  if (!(await reverseRow(db, id, actor.uid, note || "Undone within 10 minutes")))
    throw new PointsError("That entry was already reversed.");
}

async function studentBatch(db: Db, student: number) {
  const [r] = await db`select st.batch_id from students st join users u on u.id = st.user_id where st.user_id = ${student} and u.status = 'approved'`;
  if (!r) throw new PointsError("That student was not found.");
  return r.batch_id as number;
}

// ── Attendance ──
export type AttStatus = "present" | "late" | "absent" | "excused";

export async function setAttendance(db: Db, a: { student: number; day: string; status: AttStatus; arrivedAt?: string; actor: Actor; at?: Date }) {
  const rules = await getRules(db);
  const batch = await studentBatch(db, a.student);
  if (a.status === "excused") {
    if (a.actor.role !== "admin") throw new PointsError("Only an admin can excuse an absence.");
    const month = a.day.slice(0, 7);
    const [used] = await db`select count(*)::int as n from day_attendance where student_id = ${a.student} and status = 'excused'
      and to_char(day, 'YYYY-MM') = ${month} and day <> ${a.day}`;
    if (used.n >= 1) throw new PointsError("This student has already used this month's streak shield.");
  }
  const arrived = a.arrivedAt ?? "";
  await db`
    insert into day_attendance (student_id, day, batch_id, status, arrived_at, marked_by)
    values (${a.student}, ${a.day}, ${batch}, ${a.status}, ${arrived}, ${a.actor.uid})
    on conflict (student_id, day) do update set status = excluded.status,
      arrived_at = case when excluded.arrived_at <> '' then excluded.arrived_at else day_attendance.arrived_at end,
      marked_by = excluded.marked_by, updated_at = now()`;
  const [rec] = await db`select arrived_at from day_attendance where student_id = ${a.student} and day = ${a.day}`;
  const veryLate = a.status === "late" && rec.arrived_at && rec.arrived_at > String(rules.absent_cutoff);
  const want =
    a.status === "present" ? { action: "att_present", xp: rules.att_on_time, reason: "Present on time" }
    : a.status === "late" && veryLate ? { action: "att_very_late", xp: 0, reason: `Arrived ${rec.arrived_at}, after ${rules.absent_cutoff}` }
    : a.status === "late" ? { action: "att_late", xp: rules.att_late, reason: rec.arrived_at ? `Late, arrived ${rec.arrived_at}` : "Late" }
    : a.status === "excused" ? { action: "att_excused", xp: 0, reason: "Absent (excused, streak kept)" }
    : { action: "att_absent", xp: 0, reason: "Absent" };
  const existing = await db`select id, action, xp, reason from points
    where student_id = ${a.student} and day = ${a.day} and pillar = 'attendance' and action like 'att\\_%' and ${standing(db)}`;
  if (!(existing.length === 1 && existing[0].action === want.action && existing[0].xp === want.xp && existing[0].reason === want.reason)) {
    for (const e of existing) await reverseRow(db, e.id, a.actor.uid, "Attendance changed");
    await addPoint(db, { student: a.student, pillar: "attendance", ...want, staff: a.actor.uid, day: a.day, at: a.at });
  }
  // Keep the per-class attendance (used for the attendance percentages) in step.
  await db`update attendance set present = ${a.status === "present" || a.status === "late"}
    where student_id = ${a.student} and lecture_id in (select id from lectures where batch_id = ${batch} and held_on = ${a.day})`;
  await settleStreak(db, a.student, "attendance", a.day, a.actor.uid, rules);
}

// Reception's one-tap Late: stamps the arrival time.
export async function markLate(db: Db, student: number, actor: Actor, at = new Date()) {
  const { day, time } = istParts(at);
  await setAttendance(db, { student, day, status: "late", arrivedAt: time, actor, at });
}

// Reception (or an admin) can take back a Late they logged within 10 minutes, e.g. the wrong student.
export async function undoLate(db: Db, student: number, actor: Actor, day = todayIST()) {
  const [rec] = await db`select marked_by, updated_at > now() - interval '10 minutes' as fresh from day_attendance
    where student_id = ${student} and day = ${day} and status = 'late'`;
  if (!rec) throw new PointsError("There is no late arrival to undo.");
  if (actor.role !== "admin" && (rec.marked_by !== actor.uid || !rec.fresh))
    throw new PointsError("You can undo only your own late entries, within 10 minutes. Ask an admin.");
  const rows = await db`select id from points where student_id = ${student} and day = ${day} and pillar = 'attendance'
    and action like 'att\\_%' and ${standing(db)}`;
  for (const r of rows) await reverseRow(db, r.id, actor.uid, "Late entry undone");
  await db`delete from day_attendance where student_id = ${student} and day = ${day}`;
}

// ── Homework ──
type QuestRef = { book?: string; chapter?: string; exercise?: string; questions?: string };
// e.g. "NCERT Curiosity · Ch 4 · Ex 4.2 · Q1–10"
export function questLabel(q: QuestRef | Record<string, unknown>) {
  const { book, chapter, exercise, questions } = q as QuestRef;
  return [book, chapter && `Ch ${chapter}`, exercise && `Ex ${exercise}`, questions && `Q${questions}`].filter(Boolean).join(" · ");
}

export async function checkHomework(db: Db, h: { quest: number; student: number; done: boolean; stars: number; bonus: number; actor: Actor; at?: Date }) {
  const rules = await getRules(db);
  const [q] = await db`select id, batch_id, due_on::text as due_on, book, chapter, exercise, questions, lecture_id from quests where id = ${h.quest}`;
  if (!q) throw new PointsError("That homework quest was not found.");
  if ((await studentBatch(db, h.student)) !== q.batch_id) throw new PointsError("That student is not in this batch.");
  const stars = h.done ? Math.max(0, Math.min(3, Math.round(h.stars))) : 0;
  const bonus = h.done ? Math.max(0, Math.min(Number(rules.hw_bonus_max), Math.round(h.bonus))) : 0;
  await db`
    insert into quest_checks (quest_id, student_id, done, stars, bonus, checked_by)
    values (${q.id}, ${h.student}, ${h.done}, ${stars}, ${bonus}, ${h.actor.uid})
    on conflict (quest_id, student_id) do update set done = excluded.done, stars = excluded.stars, bonus = excluded.bonus,
      checked_by = excluded.checked_by, checked_at = now()`;
  const label = questLabel(q);
  const want: { action: string; xp: number; reason: string }[] = h.done
    ? [{ action: "hw_done", xp: Number(rules.hw_done) + stars * Number(rules.hw_star), reason: `Homework done${stars ? " " + "★".repeat(stars) : ""}${label ? ` (${label})` : ""}` }]
    : [{ action: "hw_missed", xp: 0, reason: `Homework not done${label ? ` (${label})` : ""}` }];
  if (bonus) want.push({ action: "hw_bonus", xp: bonus, reason: "Excellent-work bonus" });
  const existing = await db`select id, action, xp from points where student_id = ${h.student} and quest_id = ${q.id}
    and pillar = 'homework' and action in ('hw_done','hw_missed','hw_bonus') and ${standing(db)} order by id`;
  const same = existing.length === want.length && want.every((w, i) => existing[i].action === w.action && existing[i].xp === w.xp);
  if (!same) {
    for (const e of existing) await reverseRow(db, e.id, h.actor.uid, "Homework check changed");
    for (const w of want) await addPoint(db, { student: h.student, pillar: "homework", ...w, staff: h.actor.uid, quest: q.id, day: q.due_on, at: h.at });
  }
  if (q.lecture_id) await db`update attendance set homework_done = ${h.done} where lecture_id = ${q.lecture_id} and student_id = ${h.student}`;
  await settleStreak(db, h.student, "homework", q.due_on, h.actor.uid, rules);
}

// ── Class presence and discipline ──
export async function addPresence(db: Db, p: { student: number; action: PresenceAction; actor: Actor; at?: Date }) {
  const rules = await getRules(db);
  await studentBatch(db, p.student);
  const day = istParts(p.at ?? new Date()).day;
  if (p.action === "inattentive")
    return addPoint(db, { student: p.student, pillar: "presence", action: "inattentive", xp: -Number(rules.presence_minus), reason: PRESENCE.inattentive, staff: p.actor.uid, day, at: p.at });
  const [sum] = await db`select coalesce(sum(xp), 0)::int as xp from points where student_id = ${p.student} and day = ${day}
    and pillar = 'presence' and xp > 0 and ${standing(db)}`;
  const room = Number(rules.presence_cap_day) - sum.xp;
  if (room <= 0) throw new PointsError(`Daily presence cap of ${rules.presence_cap_day} XP already reached for this student.`);
  return addPoint(db, { student: p.student, pillar: "presence", action: p.action, xp: Math.min(Number(rules.presence_plus), room), reason: PRESENCE[p.action], staff: p.actor.uid, day, at: p.at });
}

export async function addDiscipline(db: Db, d: { student: number; reason: DisciplineReason; amount?: number; note?: string; actor: Actor; at?: Date }) {
  const rules = await getRules(db);
  await studentBatch(db, d.student);
  const day = istParts(d.at ?? new Date()).day;
  let xp: number;
  if (d.reason === "other") {
    const amt = Math.round(Number(d.amount));
    if (!(amt >= 5 && amt <= Number(rules.disc_other_max))) throw new PointsError(`Pick a deduction between 5 and ${rules.disc_other_max}.`);
    if (!d.note?.trim()) throw new PointsError("Add a short note for “Other”.");
    xp = -amt;
  } else xp = -Number(rules[`disc_${d.reason}` as RuleKey]);
  return addPoint(db, { student: d.student, pillar: "discipline", action: `disc_${d.reason}`, xp, reason: DISCIPLINE[d.reason], note: d.note?.trim().slice(0, 140), staff: d.actor.uid, day, at: d.at });
}

// ── Streaks ──
// School days come from the records themselves: a day counts for attendance if the batch had attendance taken,
// and for homework if a quest due that day was checked. Holidays therefore never break a streak.
export async function attendanceStreak(db: Db, student: number, upTo = todayIST()) {
  const rows = await db`
    select d.day::text, a.status from (
      select distinct day from day_attendance where batch_id = (select batch_id from students where user_id = ${student}) and day <= ${upTo}
    ) d left join day_attendance a on a.day = d.day and a.student_id = ${student}
    order by d.day desc limit 400`;
  let n = 0;
  for (const r of rows) {
    if (r.status === "excused") continue;
    if (r.status !== "present") break;
    n++;
  }
  return n;
}

export async function homeworkStreak(db: Db, student: number, upTo = todayIST()) {
  const rows = await db`
    select q.due_on::text, c.done from quests q
    left join quest_checks c on c.quest_id = q.id and c.student_id = ${student}
    where q.batch_id = (select batch_id from students where user_id = ${student}) and q.due_on <= ${upTo}
      and exists (select 1 from quest_checks x where x.quest_id = q.id)
    order by q.due_on desc limit 400`;
  let n = 0;
  for (const r of rows) {
    if (r.done !== true) break;
    n++;
  }
  return n;
}

export const STREAK_STEPS = [5, 10, 30] as const;
export function nextStep(n: number) {
  return STREAK_STEPS.find((s) => s > n) ?? null;
}

async function settleStreak(db: Db, student: number, kind: "attendance" | "homework", day: string, staff: number, rules: Rules) {
  const n = kind === "attendance" ? await attendanceStreak(db, student, day) : await homeworkStreak(db, student, day);
  for (const step of STREAK_STEPS) {
    const action = `streak_${kind}_${step}`;
    const [have] = await db`select id from points where student_id = ${student} and action = ${action} and day = ${day} and ${standing(db)}`;
    if (n === step && !have) {
      await addPoint(db, { student, pillar: kind, action, xp: Number(rules[`streak_${step}` as RuleKey]), reason: `${step}-day ${kind} streak bonus`, staff, day });
    } else if (n !== step && have) {
      await reverseRow(db, have.id, staff, "Streak changed");
    }
  }
}

// ── Clean weeks ──
// A week (Mon–Sun) with no deductions gives back half of the previous week's deductions.
// Settled lazily, once per finished week, the first time anyone loads points after it ends.
function mondayOf(day: string) {
  const d = new Date(day + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}
const addDays = (day: string, n: number) => {
  const d = new Date(day + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

export async function settleCleanWeeks() {
  const thisMonday = mondayOf(todayIST());
  const [state] = await sql`select value from app_state where key = 'clean_weeks_through'`;
  if (state?.value >= thisMonday) return;
  await sql.begin(async (tx) => {
    await tx`select pg_advisory_xact_lock(73311)`;
    const [st] = await tx`select value from app_state where key = 'clean_weeks_through'`;
    const [first] = await tx`select min(day)::text as d from points`;
    if (!first?.d) {
      await tx`insert into app_state values ('clean_weeks_through', ${thisMonday}) on conflict (key) do update set value = excluded.value`;
      return;
    }
    // Weeks are settled when the week after them has finished: [prev, week) had deductions, [week, next) had none.
    let week = st?.value ? st.value as string : addDays(mondayOf(first.d), 7);
    while (addDays(week, 7) <= thisMonday) {
      const prev = addDays(week, -7), next = addDays(week, 7);
      await tx`
        insert into points (student_id, pillar, action, xp, reason, staff_id, day)
        select d.student_id, 'discipline', 'clean_week', (abs(d.xp) / 2)::int,
          ${"Clean week: half of last week's deductions back"}, null, ${addDays(week, 5)}::date
        from (select student_id, sum(xp) as xp from points
              where pillar = 'discipline' and xp < 0 and reversed_by_id is null and reverses_id is null
                and day >= ${prev} and day < ${week} group by student_id) d
        where abs(d.xp) / 2 >= 1 and not exists (
          select 1 from points p where p.student_id = d.student_id and p.pillar = 'discipline' and p.xp < 0
            and p.reversed_by_id is null and p.reverses_id is null and p.day >= ${week} and p.day < ${next})
          and not exists (select 1 from points c where c.student_id = d.student_id and c.action = 'clean_week' and c.day = ${addDays(week, 5)}::date)`;
      week = next;
    }
    await tx`insert into app_state values ('clean_weeks_through', ${week}) on conflict (key) do update set value = excluded.value`;
  });
}

// ── Reading points ──────────────────────────────────────────────────────────
export type BoardRow = {
  id: number; name: string; roll_no: string; net: number; earned: number; deductions: number; today: number; before_today: number;
  pillars: Record<Pillar, number>; level: number; title: string; rank: number; rank_before: number;
};

// The class leaderboard for a batch: net XP since the term started.
export async function batchBoard(batchId: number): Promise<BoardRow[]> {
  await settleCleanWeeks();
  const rules = await getRules();
  const today = todayIST();
  const rows = await sql`
    select u.id, u.name, st.roll_no,
      coalesce(sum(p.xp), 0)::int as net,
      coalesce(sum(p.xp) filter (where p.xp > 0 and p.reversed_by_id is null and p.reverses_id is null), 0)::int as earned,
      count(p.*) filter (where p.xp < 0 and p.reversed_by_id is null and p.reverses_id is null)::int as deductions,
      coalesce(sum(p.xp) filter (where p.day = ${today}), 0)::int as today,
      coalesce(sum(p.xp) filter (where p.pillar = 'homework'), 0)::int as homework,
      coalesce(sum(p.xp) filter (where p.pillar = 'attendance'), 0)::int as attendance,
      coalesce(sum(p.xp) filter (where p.pillar = 'presence'), 0)::int as presence,
      coalesce(sum(p.xp) filter (where p.pillar = 'discipline'), 0)::int as discipline,
      coalesce(sum(p.xp) filter (where p.pillar = 'selfstudy'), 0)::int as selfstudy
    from students st join users u on u.id = st.user_id and u.active and u.status = 'approved'
    left join points p on p.student_id = u.id and p.day >= ${String(rules.term_start)}::date
    where st.batch_id = ${batchId}
    group by u.id, u.name, st.roll_no`;
  const sortBy = (key: "net" | "before_today") => (a: BoardRow, b: BoardRow) =>
    b[key] - a[key] || a.deductions - b.deductions || a.name.localeCompare(b.name);
  const list: BoardRow[] = rows.map((r) => {
    const level = levelOf(r.earned);
    return {
      id: r.id, name: r.name, roll_no: r.roll_no, net: r.net, earned: r.earned, deductions: r.deductions, today: r.today,
      before_today: r.net - r.today, level, title: titleOf(level), rank: 0, rank_before: 0,
      pillars: { homework: r.homework, attendance: r.attendance, presence: r.presence, discipline: r.discipline, selfstudy: r.selfstudy },
    };
  });
  [...list].sort(sortBy("before_today")).forEach((r, i) => (r.rank_before = i + 1));
  list.sort(sortBy("net")).forEach((r, i) => (r.rank = i + 1));
  return list;
}

export type FeedRow = { id: number; pillar: Pillar; action: string; xp: number; reason: string; note: string; day: string; created_at: Date; staff: string | null; reversed: boolean; is_reversal: boolean; staff_id: number | null };

export const studentFeed = (studentId: number, limit = 40) =>
  sql<FeedRow[]>`
    select p.id, p.pillar, p.action, p.xp, p.reason, p.note, p.day::text, p.created_at, u.name as staff, p.staff_id,
      p.reversed_by_id is not null as reversed, p.reverses_id is not null as is_reversal
    from points p left join users u on u.id = p.staff_id
    where p.student_id = ${studentId} order by p.created_at desc, p.id desc limit ${limit}`;

export async function pillarTotals(studentId: number) {
  const rules = await getRules();
  const monday = mondayOf(todayIST());
  const rows = await sql`
    select pillar, coalesce(sum(xp) filter (where day >= ${monday}), 0)::int as week, coalesce(sum(xp), 0)::int as term
    from points where student_id = ${studentId} and day >= ${String(rules.term_start)}::date group by pillar`;
  const out = Object.fromEntries(PILLARS.map((p) => [p.key, { week: 0, term: 0 }])) as Record<Pillar, { week: number; term: number }>;
  for (const r of rows) out[r.pillar as Pillar] = { week: r.week, term: r.term };
  return out;
}
