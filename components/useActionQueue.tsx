"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

// Taps from class mode and the reception desk are queued on the device and sent in batches.
// If the connection drops they wait (with their original time) and are sent when it is back.
// Each login keeps its own queue, so taps left on a shared phone are only ever sent as the person who made them.
export type QueuedAction = { id: string; at: string; type: string; [k: string]: unknown };
const keyFor = (owner: number) => `acads-action-queue:${owner}`;

const read = (key: string): QueuedAction[] => {
  try {
    return JSON.parse(localStorage.getItem(key) || "[]");
  } catch {
    return [];
  }
};
const write = (key: string, q: QueuedAction[]) => {
  try {
    localStorage.setItem(key, JSON.stringify(q));
  } catch {}
};
const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

export function useActionQueue(owner: number, onError: (msg: string) => void) {
  const key = keyFor(owner);
  const router = useRouter();
  const [pending, setPending] = useState(0);
  const [offline, setOffline] = useState(false);
  const busy = useRef(false);
  const memory = useRef<QueuedAction[]>([]);

  const load = () => {
    const stored = read(key);
    return stored.length || !memory.current.length ? stored : memory.current;
  };
  const save = (q: QueuedAction[]) => {
    memory.current = q;
    write(key, q);
    setPending(q.length);
  };

  const flush = useCallback(async () => {
    if (busy.current) return;
    const batch = load();
    if (!batch.length) return;
    busy.current = true;
    try {
      const res = await fetch("/api/points", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ actions: batch }) });
      if (res.status === 401) {
        onError("You were signed out. Sign in again; your taps are kept on this device.");
        return;
      }
      if (!res.ok) throw new Error(String(res.status));
      const { results } = (await res.json()) as { results: { id: string; ok: boolean; error?: string; retry?: boolean }[] };
      // A server hiccup rolls the tap back, so it stays queued and is tried again; anything else is settled.
      const answered = new Set(results.filter((r) => !r.retry).map((r) => r.id));
      for (const r of results) if (!r.ok && r.error && !r.retry) onError(r.error);
      save(load().filter((a) => !answered.has(a.id)));
      setOffline(results.some((r) => r.retry));
      router.refresh();
    } catch {
      setOffline(true);
    } finally {
      busy.current = false;
    }
  }, [router, onError, key]);

  const send = useCallback(
    (a: Omit<QueuedAction, "id" | "at">) => {
      save([...load(), { ...a, id: newId(), at: new Date().toISOString() } as QueuedAction]);
      void flush();
    },
    [flush],
  );

  useEffect(() => {
    setPending(load().length);
    void flush();
    const t = setInterval(() => void flush(), 5000);
    const online = () => void flush();
    window.addEventListener("online", online);
    return () => {
      clearInterval(t);
      window.removeEventListener("online", online);
    };
  }, [flush]);

  return { send, pending, offline };
}

export function SyncPill({ pending, offline }: { pending: number; offline: boolean }) {
  const [label, cls] = offline && pending
    ? [`Offline · ${pending} waiting`, "c-bad"]
    : pending
      ? [`Saving ${pending}…`, "c-warn"]
      : ["All saved", "c-good"];
  return <span className={`chip ${cls}`} role="status" aria-live="polite">{label}</span>;
}
