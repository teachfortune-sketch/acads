import { sql } from "./db";
import { addDays, attendanceStreak, batchBoard, homeworkStreak } from "./points";
import { fmtDate, todayIST } from "./util";

const DISC: Record<string, string> = { disc_uniform: "uniform", disc_phone: "phone", disc_disruption: "disruption", disc_misbehaviour: "misbehaviour", disc_other: "other" };

// The weekly message for one class: one short paragraph per student, written for a parent reading it on WhatsApp or SMS.
export async function weeklySummaries(batchId: number, batchName: string, week: string, site: string) {
  const end = addDays(week, 7);
  // Homework counts every quest due so far this week, so work a teacher has not checked yet is not hidden.
  const due = [end, addDays(todayIST(), 1)].sort()[0];
  const [board, rows] = await Promise.all([
    batchBoard(batchId),
    sql`
      select u.id, u.name, st.parent_mobile, st.parent_name, st.parent_id, ps.channel as sent, ps.at as sent_at,
        (select count(*) filter (where status = 'present')::int from day_attendance where student_id = u.id and day >= ${week} and day < ${end}) as present,
        (select count(*) filter (where status = 'late')::int from day_attendance where student_id = u.id and day >= ${week} and day < ${end}) as late,
        (select count(*) filter (where status = 'absent')::int from day_attendance where student_id = u.id and day >= ${week} and day < ${end}) as absent,
        (select count(*)::int from quests q where q.batch_id = st.batch_id and q.due_on >= ${week} and q.due_on < ${due}) as hw_total,
        (select count(*)::int from quest_checks c join quests q on q.id = c.quest_id where c.student_id = u.id and q.due_on >= ${week} and q.due_on < ${due}) as hw_checked,
        (select count(*) filter (where c.done)::int from quest_checks c join quests q on q.id = c.quest_id where c.student_id = u.id and q.due_on >= ${week} and q.due_on < ${due}) as hw_done,
        (select coalesce(sum(xp), 0)::int from points where student_id = u.id and day >= ${week} and day < ${end}) as week_xp,
        (select coalesce(sum(xp), 0)::int from points where student_id = u.id and pillar = 'presence' and day >= ${week} and day < ${end}) as presence,
        (select count(*)::int from points where student_id = u.id and action in ('ss_verified','ss_great') and xp >= 0
          and reversed_by_id is null and reverses_id is null and day >= ${week} and day < ${end}) as selfstudy,
        (select coalesce(array_agg(action order by day), '{}') from points where student_id = u.id and pillar = 'discipline' and xp < 0
          and reversed_by_id is null and reverses_id is null and day >= ${week} and day < ${end}) as deductions
      from students st join users u on u.id = st.user_id and u.active and u.status = 'approved'
      left join parent_summaries ps on ps.student_id = u.id and ps.week_start = ${week}
      where st.batch_id = ${batchId} order by u.name`,
  ]);
  const out = [];
  for (const r of rows) {
    const b = board.find((x) => x.id === r.id);
    const [hw, att] = await Promise.all([homeworkStreak(sql, r.id, addDays(end, -1)), attendanceStreak(sql, r.id, addDays(end, -1))]);
    const first = String(r.name).split(" ")[0];
    const days = r.present + r.late + r.absent;
    const lines = [
      `Acads weekly update for ${r.name} (${batchName}), ${fmtDate(week)} to ${fmtDate(addDays(week, 5))}:`,
      `XP this week: ${r.week_xp >= 0 ? "+" : ""}${r.week_xp}.${b ? ` Total ${b.net} XP, rank ${b.rank} of ${board.length}, Level ${b.level} ${b.title}.` : ""}`,
      days ? `Attendance: ${r.present} on time${r.late ? `, ${r.late} late` : ""}${r.absent ? `, ${r.absent} absent` : ""} (of ${days} days).` : "Attendance: no classes recorded.",
      r.hw_total ? `Homework: ${r.hw_done} of ${r.hw_total} done${r.hw_total > r.hw_checked ? ` (${r.hw_total - r.hw_checked} not checked yet)` : ""}.` : "",
      r.presence ? `Class presence: ${r.presence > 0 ? "+" : ""}${r.presence} XP.` : "",
      r.selfstudy ? `Self-study: ${r.selfstudy} task${r.selfstudy === 1 ? "" : "s"} checked by teachers.` : "",
      r.deductions.length ? `Discipline: ${r.deductions.map((a: string) => DISC[a] ?? "other").join(", ")}.` : "Discipline: no deductions. Well done!",
      hw >= 2 || att >= 2 ? `Streaks: ${[hw >= 2 && `homework ${hw} days`, att >= 2 && `attendance ${att} days`].filter(Boolean).join(", ")}.` : "",
      `See every point: ${site}/login`,
    ].filter(Boolean);
    out.push({ id: r.id as number, name: r.name as string, first, mobile: (r.parent_mobile as string) || "", parentName: (r.parent_name as string) || "",
      sent: r.sent as string | null, sentAt: r.sent_at as Date | null, text: lines.join("\n") });
  }
  return out;
}
