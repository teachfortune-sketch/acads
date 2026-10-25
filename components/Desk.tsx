"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SyncPill, useActionQueue } from "./useActionQueue";

export type DeskStudent = { id: number; name: string; batch: string; section: string; roll: string; late: string | null };
const REASONS = [["uniform", "Uniform"], ["phone", "Phone found"], ["misbehaviour", "Misbehaviour"], ["disruption", "Disruption"]] as const;

export function Desk({ students, values }: { students: DeskStudent[]; values: { disc: Record<string, number>; otherMax: number } }) {
  const [q, setQ] = useState("");
  const [pick, setPick] = useState<DeskStudent | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [other, setOther] = useState(false);
  const [amount, setAmount] = useState(5);
  const [note, setNote] = useState("");
  const [lateNow, setLateNow] = useState<Record<number, string>>({});
  const input = useRef<HTMLInputElement>(null);
  const { send, pending, offline } = useActionQueue(useCallback((m: string) => setToast(m), []));

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  // Name anywhere in the full name, or roll number from the start.
  const results = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return [];
    return students.filter((s) => s.name.toLowerCase().includes(t) || (s.roll && s.roll.toLowerCase().startsWith(t))).slice(0, 8);
  }, [q, students]);

  const done = (msg: string) => {
    setToast(msg);
    setPick(null);
    setQ("");
    setOther(false);
    setNote("");
    input.current?.focus();
  };
  const time = () => new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date());

  return (
    <div className="stack">
      <div className="panel stack desk-search">
        <div className="row-actions" style={{ justifyContent: "space-between" }}>
          <label htmlFor="desk-q" style={{ fontSize: "1rem" }}>Find a student</label>
          <SyncPill pending={pending} offline={offline} />
        </div>
        <input id="desk-q" ref={input} autoFocus autoComplete="off" value={q} placeholder="Name or roll number"
          onChange={(e) => { setQ(e.target.value); setPick(null); }}
          onKeyDown={(e) => { if (e.key === "Enter" && results[0]) setPick(results[0]); }} />
        {!pick && results.length > 0 && (
          <div className="desk-results">
            {results.map((s) => (
              <button type="button" key={s.id} onClick={() => setPick(s)}>
                <b>{s.name}</b>
                <span className="muted small">{s.batch}{s.section ? `-${s.section}` : ""} · roll {s.roll || "–"}</span>
                {(s.late || lateNow[s.id]) && <span className="chip c-warn">Late {lateNow[s.id] ?? s.late}</span>}
              </button>
            ))}
          </div>
        )}
        {!pick && q.trim() && !results.length && <p className="muted">No student matches “{q}”.</p>}
      </div>
      {pick && (
        <div className="panel stack desk-card">
          <div>
            <h2>{pick.name}</h2>
            <p className="muted">{pick.batch}{pick.section ? ` · section ${pick.section}` : ""} · roll {pick.roll || "–"}</p>
          </div>
          {pick.late || lateNow[pick.id] ? (
            <p className="banner">Already marked late today at {lateNow[pick.id] ?? pick.late}.</p>
          ) : (
            <button type="button" className="btn-late" onClick={() => {
              const t = time();
              setLateNow((l) => ({ ...l, [pick.id]: t }));
              send({ type: "late", student: pick.id });
              done(`Late logged for ${pick.name} at ${t}`);
            }}>Late · {time()}</button>
          )}
          <div className="sheet-row">
            <span className="small muted">Discipline</span>
            {REASONS.map(([k, label]) => (
              <button type="button" key={k} className="btn-danger" onClick={() => {
                send({ type: "discipline", student: pick.id, reason: k });
                done(`${label} −${values.disc[k]} for ${pick.name}`);
              }}>{label} −{values.disc[k]}</button>
            ))}
            <button type="button" onClick={() => setOther(!other)}>Other…</button>
          </div>
          {other && (
            <form className="sheet-row" onSubmit={(e) => {
              e.preventDefault();
              send({ type: "discipline", student: pick.id, reason: "other", amount, note });
              done(`Other −${amount} for ${pick.name}`);
            }}>
              <select aria-label="Points to deduct" value={amount} onChange={(e) => setAmount(Number(e.target.value))} style={{ width: "auto" }}>
                {[5, 10, 15, 20, 25].filter((v) => v <= values.otherMax).map((v) => <option key={v} value={v}>−{v}</option>)}
              </select>
              <input aria-label="Note" placeholder="What happened (required)" required maxLength={140} value={note}
                onChange={(e) => setNote(e.target.value)} style={{ flex: "1 1 180px", width: "auto" }} />
              <button type="submit" className="btn-danger">Deduct</button>
            </form>
          )}
          <div><button type="button" className="small" onClick={() => done("")}>Cancel</button></div>
        </div>
      )}
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}

// Undo for the late list and today's discipline list (own entries, 10 minutes).
export function DeskUndo({ action, label }: { action: { type: "unlate"; student: number } | { type: "undo"; point: number }; label: string }) {
  const [gone, setGone] = useState(false);
  const { send } = useActionQueue(useCallback(() => {}, []));
  if (gone) return <span className="muted small">Undoing…</span>;
  return <button type="button" className="small" onClick={() => { send(action); setGone(true); }}>{label}</button>;
}
