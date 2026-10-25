import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { sql } from "@/lib/db";
import { currentUser, STAFF } from "@/lib/auth";
import {
  addDiscipline, addPresence, AttStatus, checkHomework, DISCIPLINE, DisciplineReason, istParts, markLate, PointsError,
  PRESENCE, PresenceAction, setAttendance, setRoutine, undoLate, undoPoint, verifyTask,
} from "@/lib/points";

// Class mode and the reception desk send their taps here in batches. Each action has an id from the device,
// so a batch resent after a dropped connection is only counted once, and its time is when the tap happened.
type Action =
  | { id: string; at: string; type: "attendance"; student: number; day: string; status: AttStatus }
  | { id: string; at: string; type: "late"; student: number }
  | { id: string; at: string; type: "homework"; student: number; quest: number; done: boolean; stars: number; bonus: number }
  | { id: string; at: string; type: "presence"; student: number; action: PresenceAction }
  | { id: string; at: string; type: "discipline"; student: number; reason: DisciplineReason; amount?: number; note?: string }
  | { id: string; at: string; type: "undo"; point: number }
  | { id: string; at: string; type: "unlate"; student: number }
  | { id: string; at: string; type: "selfstudy"; task: number; verdict: "verified" | "great" | null; comment?: string }
  | { id: string; at: string; type: "routine"; student: number; days: number };

const ALLOWED: Record<Action["type"], string[]> = {
  attendance: ["admin", "teacher"], homework: ["admin", "teacher"], presence: ["admin", "teacher"],
  late: ["admin", "reception"], unlate: ["admin", "reception"], discipline: STAFF, undo: STAFF,
  selfstudy: ["admin", "teacher"], routine: ["admin", "teacher"],
};

// Taps queued offline keep their own time, but never from the future or more than 3 days back.
function when(at: string) {
  const t = new Date(at).getTime(), now = Date.now();
  return Number.isFinite(t) && t <= now + 60_000 && t >= now - 3 * 86_400_000 ? new Date(Math.min(t, now)) : new Date();
}

export async function POST(req: Request) {
  const s = await currentUser();
  if (!s || s.mustChange || !STAFF.includes(s.role)) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
  const body = await req.json().catch(() => null);
  const actions: Action[] = Array.isArray(body?.actions) ? body.actions.slice(0, 200) : [];
  const results: { id: string; ok: boolean; error?: string; retry?: boolean }[] = [];
  for (const a of actions) {
    if (typeof a?.id !== "string" || !a.id || a.id.length > 64) continue;
    if (!ALLOWED[a.type]?.includes(s.role)) { results.push({ id: a.id, ok: false, error: "Your role can't do that." }); continue; }
    try {
      await sql.begin(async (tx) => {
        const [fresh] = await tx`insert into client_actions (id) values (${a.id}) on conflict do nothing returning id`;
        if (!fresh) return; // already applied
        const at = when(a.at);
        const actor = { uid: s.uid, role: s.role };
        switch (a.type) {
          case "attendance":
            if (!["present", "late", "absent", "excused"].includes(a.status)) throw new PointsError("Unknown attendance status.");
            if (!/^\d{4}-\d{2}-\d{2}$/.test(a.day)) throw new PointsError("Bad date.");
            return setAttendance(tx, { student: Number(a.student), day: a.day, status: a.status, actor, at,
              arrivedAt: a.status === "late" ? istParts(at).time : undefined });
          case "late":
            return markLate(tx, Number(a.student), actor, at);
          case "homework":
            return checkHomework(tx, { quest: Number(a.quest), student: Number(a.student), done: !!a.done, stars: Number(a.stars) || 0, bonus: Number(a.bonus) || 0, actor, at });
          case "presence":
            if (!(a.action in PRESENCE)) throw new PointsError("Unknown action.");
            return addPresence(tx, { student: Number(a.student), action: a.action, actor, at });
          case "discipline":
            if (!(a.reason in DISCIPLINE)) throw new PointsError("Unknown reason.");
            return addDiscipline(tx, { student: Number(a.student), reason: a.reason, amount: Number(a.amount), note: String(a.note ?? ""), actor, at });
          case "undo":
            return undoPoint(tx, Number(a.point), actor, "");
          case "selfstudy":
            if (![null, "verified", "great"].includes(a.verdict)) throw new PointsError("Unknown check.");
            return verifyTask(tx, { task: Number(a.task), verdict: a.verdict, comment: String(a.comment ?? ""), actor, at });
          case "routine":
            return setRoutine(tx, { student: Number(a.student), days: Number(a.days), actor, at });
          case "unlate":
            return undoLate(tx, Number(a.student), actor, istParts(at).day);
        }
      });
      results.push({ id: a.id, ok: true });
    } catch (e) {
      if (e instanceof PointsError) results.push({ id: a.id, ok: false, error: e.message });
      else {
        console.error(e);
        results.push({ id: a.id, ok: false, retry: true });
      }
    }
  }
  revalidatePath("/", "layout");
  return NextResponse.json({ results });
}
