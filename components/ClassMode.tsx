"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { SyncPill, useActionQueue } from "./useActionQueue";

export type Tile = {
  id: number; name: string; roll: string; status: "present" | "late" | "absent" | "excused" | null; arrived: string;
  todayXp: number; hw: { done: boolean; stars: number; bonus: number } | null;
  ss: { id: number; text: string; chapter: string; done: boolean; verdict: "verified" | "great" | null }[]; routine: number | null;
};
export type Recent = { id: number; student: number; reason: string; xp: number };
type Mode = "attendance" | "homework" | "presence" | "selfstudy";
const MODES: [Mode, string][] = [["attendance", "Attendance"], ["homework", "Homework"], ["presence", "Presence"], ["selfstudy", "Self-study"]];

const PRESENCE_BUTTONS = [["attentive", "Attentive"], ["answered", "Answered"], ["good_question", "Good question"], ["helped", "Helped a classmate"]] as const;
const DISCIPLINE_BUTTONS = [["uniform", "Uniform"], ["phone", "Phone found"], ["disruption", "Disruption"], ["misbehaviour", "Misbehaviour"]] as const;
const STATUS_LABEL = { present: "Present", late: "Late", absent: "Absent", excused: "Excused" } as const;
const STATUS_CHIP = { present: "c-good", late: "c-warn", absent: "c-bad", excused: "c-info" } as const;

export function ClassMode(props: {
  owner: number; day: string; tiles: Tile[]; quest: { id: number; label: string } | null; isAdmin: boolean; recent: Recent[];
  values: { plus: number; minus: number; hwBonusMax: number; disc: Record<string, number>; otherMax: number; ssVerified: number; ssGreat: number; ssCap: number };
}) {
  const [mode, setMode] = useState<Mode>("attendance");
  const [open, setOpen] = useState<number | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [local, setLocal] = useState<Record<number, Partial<Tile>>>({});
  const showError = useCallback((m: string) => setToast(m), []);
  const { send, pending, offline } = useActionQueue(props.owner, showError);

  // Fresh data from the server replaces what we showed optimistically, once nothing is waiting to be sent.
  const waiting = useRef(pending);
  waiting.current = pending;
  useEffect(() => {
    if (!waiting.current) setLocal({});
  }, [props.tiles]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  const tiles = props.tiles.map((t) => ({ ...t, ...local[t.id] }));
  const patch = (id: number, p: Partial<Tile>) => setLocal((l) => ({ ...l, [id]: { ...l[id], ...p } }));

  const cycle = (t: Tile) => {
    const order: Tile["status"][] = props.isAdmin ? ["present", "absent", "late", "excused"] : ["present", "absent", "late"];
    const next = order[(order.indexOf(t.status ?? "present") + 1) % order.length]!;
    patch(t.id, { status: next });
    send({ type: "attendance", student: t.id, day: props.day, status: next });
  };
  const homework = (t: Tile, done: boolean, stars: number, bonus: number) => {
    patch(t.id, { hw: { done, stars, bonus } });
    send({ type: "homework", student: t.id, quest: props.quest!.id, done, stars, bonus });
  };
  const presence = (t: Tile, action: string, label: string, xp: number) => {
    patch(t.id, { todayXp: t.todayXp + xp });
    send({ type: "presence", student: t.id, action });
    setToast(`${label} ${xp > 0 ? "+" : "−"}${Math.abs(xp)} · ${t.name}`);
  };
  const selfstudy = (t: Tile, task: Tile["ss"][number], verdict: "verified" | "great" | null) => {
    patch(t.id, { ss: t.ss.map((x) => (x.id === task.id ? { ...x, verdict } : x)) });
    send({ type: "selfstudy", task: task.id, verdict });
    if (verdict) setToast(`${verdict === "great" ? "Great plan" : "Verified"} · ${t.name}`);
  };
  const routine = (t: Tile, days: number) => {
    patch(t.id, { routine: days });
    send({ type: "routine", student: t.id, days, day: props.day });
  };
  const deduct = (t: Tile, reason: string, label: string, amount: number, note = "") => {
    patch(t.id, { todayXp: t.todayXp - amount });
    send({ type: "discipline", student: t.id, reason, amount, note });
    setToast(`${label} −${amount} · ${t.name}`);
    setOpen(null);
  };

  const sel = tiles.find((t) => t.id === open) ?? null;
  const present = tiles.filter((t) => t.status !== "absent" && t.status !== "excused").length;
  const checked = tiles.filter((t) => t.hw).length;

  return (
    <div className="stack">
      <div className="cm-bar">
        <div className="chips" role="tablist" aria-label="Mode">
          {MODES.map(([m, label]) => (
            <a key={m} href={`#${m}`} role="tab" aria-selected={mode === m} aria-current={mode === m}
              onClick={(e) => { e.preventDefault(); setMode(m); setOpen(null); }}>
              {label}
            </a>
          ))}
        </div>
        <SyncPill pending={pending} offline={offline} />
      </div>
      <p className="muted small">
        {mode === "attendance" && <>Everyone starts present. Tap a student to cycle Absent → Late{props.isAdmin ? " → Excused" : ""} → Present. <b className="num">{present}/{tiles.length}</b> here.</>}
        {mode === "homework" && (props.quest
          ? <>Checking <b>{props.quest.label}</b>. Tap a student to mark it. <b className="num">{checked}/{tiles.length}</b> checked.</>
          : <>No homework was set for today. Post tomorrow&apos;s homework below.</>)}
        {mode === "presence" && <>Only tap the standouts; everyone else counts as normal. Deductions are here too.</>}
        {mode === "selfstudy" && <>Check notebooks against the tasks students shared with you. Up to {props.values.ssCap} tasks per subject a week earn XP. Ask how many days they followed their routine.</>}
      </p>
      <div className="tiles">
        {tiles.map((t) => {
          const st = t.status ?? "present";
          return (
            <button key={t.id} type="button" className={`tile st-${st}${open === t.id ? " open" : ""}`}
              onClick={() => (mode === "attendance" ? cycle(t) : mode === "homework" && !props.quest ? null : setOpen(open === t.id ? null : t.id))}
              aria-label={`${t.name}${t.roll ? `, roll ${t.roll}` : ""}`}>
              <span className="tile-top">
                <span className="num small">{t.roll || "–"}</span>
                <span className={`num tile-xp ${t.todayXp < 0 ? "neg" : ""}`}>{t.todayXp > 0 ? "+" : ""}{t.todayXp}</span>
              </span>
              <b className="tile-name">{t.name}</b>
              <span className="tile-tags">
                {mode === "attendance" && <span className={`chip ${STATUS_CHIP[st]}`}>{STATUS_LABEL[st]}{st === "late" && t.arrived ? ` ${t.arrived}` : ""}</span>}
                {mode !== "attendance" && st === "late" && <span className="chip c-warn">Late{t.arrived ? ` ${t.arrived}` : ""}</span>}
                {mode !== "attendance" && (st === "absent" || st === "excused") && <span className="chip c-bad">Absent</span>}
                {mode === "selfstudy" && (() => {
                  const waiting = t.ss.filter((x) => !x.verdict).length, checked = t.ss.length - waiting;
                  return <>
                    <span className={`chip ${waiting ? "c-pink" : ""}`}>{t.ss.length ? `${waiting} to check${checked ? ` · ${checked} done` : ""}` : "No tasks"}</span>
                    {t.routine != null && <span className="chip c-good">Routine {t.routine}/6</span>}
                  </>;
                })()}
                {mode === "homework" && (t.hw
                  ? <span className={`chip ${t.hw.done ? "c-good" : "c-bad"}`}>{t.hw.done ? `Done ${"★".repeat(t.hw.stars)}${t.hw.bonus ? ` +${t.hw.bonus}` : ""}` : "Not done"}</span>
                  : <span className="chip">Not checked</span>)}
              </span>
            </button>
          );
        })}
      </div>
      {sel && mode !== "attendance" && (
        <div className="sheet" role="dialog" aria-label={sel.name}>
          <div className="row-actions" style={{ justifyContent: "space-between" }}>
            <h3>{sel.name}</h3>
            <button type="button" className="small" onClick={() => setOpen(null)}>Close</button>
          </div>
          {mode === "homework" && props.quest && (
            <>
              <div className="sheet-row">
                <button type="button" className="btn-danger" onClick={() => homework(sel, false, 0, 0)}>Not done</button>
                {[0, 1, 2, 3].map((n) => (
                  <button type="button" key={n} className={sel.hw?.done && sel.hw.stars === n ? "btn-p" : ""}
                    onClick={() => homework(sel, true, n, sel.hw?.done ? sel.hw.bonus : 0)}>
                    Done{n ? " " + "★".repeat(n) : ""}
                  </button>
                ))}
              </div>
              {sel.hw?.done && (
                <div className="sheet-row">
                  <span className="small muted">Excellent-work bonus</span>
                  {[0, 5, 10, props.values.hwBonusMax].filter((v, i, a) => a.indexOf(v) === i).map((b) => (
                    <button type="button" key={b} className={`small ${sel.hw!.bonus === b ? "btn-p" : ""}`}
                      onClick={() => homework(sel, true, sel.hw!.stars, b)}>{b ? `+${b}` : "None"}</button>
                  ))}
                </div>
              )}
            </>
          )}
          {mode === "selfstudy" && (
            <>
              {sel.ss.length ? sel.ss.map((task) => (
                <div key={task.id} className="sheet-task">
                  <div><b>{task.text}</b>{task.chapter && <span className="small muted"> · {task.chapter}</span>}{task.done && <span className="chip c-good small">Ticked done</span>}</div>
                  <div className="sheet-row">
                    <button type="button" className={task.verdict === "verified" ? "btn-p" : "btn-mint"} onClick={() => selfstudy(sel, task, task.verdict === "verified" ? null : "verified")}>
                      {task.verdict === "verified" ? "Verified ✓" : `Verified +${props.values.ssVerified}`}</button>
                    <button type="button" className={task.verdict === "great" ? "btn-p" : "btn-yellow"} onClick={() => selfstudy(sel, task, task.verdict === "great" ? null : "great")}>
                      {task.verdict === "great" ? "Great plan ✓" : `Great plan +${props.values.ssGreat}`}</button>
                  </div>
                </div>
              )) : <p className="small muted">{sel.name.split(" ")[0]} hasn&apos;t shared a task for this subject this week.</p>}
              <div className="sheet-row">
                <span className="small muted">Routine followed this week (days)</span>
                {[0, 1, 2, 3, 4, 5, 6].map((d) => (
                  <button type="button" key={d} className={`small ${sel.routine === d ? "btn-p" : ""}`} onClick={() => routine(sel, d)}>{d}</button>
                ))}
              </div>
            </>
          )}
          {mode === "presence" && <PresenceSheet t={sel} values={props.values} recent={props.recent.filter((r) => r.student === sel.id)}
            onPresence={presence} onDeduct={deduct} onUndo={(r) => { send({ type: "undo", point: r.id }); setToast(`Undone: ${r.reason}`); }} />}
        </div>
      )}
      {sel && mode !== "attendance" && <div className="cm-pad" aria-hidden />}
      {toast && <div className={`toast${sel ? " toast-top" : ""}`} role="status">{toast}</div>}
    </div>
  );
}

function PresenceSheet({ t, values, recent, onPresence, onDeduct, onUndo }: {
  t: Tile; values: { plus: number; minus: number; disc: Record<string, number>; otherMax: number }; recent: Recent[];
  onPresence: (t: Tile, action: string, label: string, xp: number) => void;
  onDeduct: (t: Tile, reason: string, label: string, amount: number, note?: string) => void;
  onUndo: (r: Recent) => void;
}) {
  const [other, setOther] = useState(false);
  const [amount, setAmount] = useState(5);
  const [note, setNote] = useState("");
  return (
    <>
      <div className="sheet-row">
        {PRESENCE_BUTTONS.map(([k, label]) => (
          <button type="button" key={k} className="btn-mint" onClick={() => onPresence(t, k, label, values.plus)}>{label} +{values.plus}</button>
        ))}
        <button type="button" className="btn-yellow" onClick={() => onPresence(t, "inattentive", "Inattentive", -values.minus)}>Inattentive −{values.minus}</button>
      </div>
      <div className="sheet-row">
        <span className="small muted">Deduct</span>
        {DISCIPLINE_BUTTONS.map(([k, label]) => (
          <button type="button" key={k} className="btn-danger small" onClick={() => onDeduct(t, k, label, values.disc[k])}>{label} −{values.disc[k]}</button>
        ))}
        <button type="button" className="small" onClick={() => setOther(!other)}>Other…</button>
      </div>
      {other && (
        <form className="sheet-row" onSubmit={(e) => { e.preventDefault(); onDeduct(t, "other", "Other", amount, note); }}>
          <select aria-label="Points to deduct" value={amount} onChange={(e) => setAmount(Number(e.target.value))} style={{ width: "auto" }}>
            {[5, 10, 15, 20, 25].filter((v) => v <= values.otherMax).map((v) => <option key={v} value={v}>−{v}</option>)}
          </select>
          <input aria-label="Note" placeholder="What happened (required)" required maxLength={140} value={note} onChange={(e) => setNote(e.target.value)} style={{ flex: "1 1 160px", width: "auto" }} />
          <button type="submit" className="btn-danger small">Deduct</button>
        </form>
      )}
      {recent.length > 0 && (
        <div className="sheet-row">
          <span className="small muted">Your entries in the last 10 min</span>
          {recent.map((r) => (
            <button type="button" key={r.id} className="small" onClick={() => onUndo(r)}>Undo {r.reason} ({r.xp > 0 ? "+" : ""}{r.xp})</button>
          ))}
        </div>
      )}
    </>
  );
}
