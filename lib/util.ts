export function str(fd: FormData, k: string) {
  return String(fd.get(k) ?? "").trim();
}
export function int(fd: FormData, k: string) {
  const n = Number(fd.get(k));
  return Number.isInteger(n) && n > 0 ? n : null;
}

// Coaching runs in India, so "today" is Indian time.
export function todayIST() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
}

export function fmtDate(d: string | Date) {
  const date = typeof d === "string" ? new Date(d + "T00:00:00") : d;
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short", weekday: "short", timeZone: "Asia/Kolkata" });
}

export function pct(x: number | null | undefined) {
  return x == null ? "–" : Math.round(x * 100) + "%";
}

export function level(score: number | null): [string, string] {
  if (score == null) return ["No tests yet", "c-info"];
  if (score >= 0.8) return ["Strong", "c-good"];
  if (score >= 0.6) return ["On track", "c-warn"];
  return ["Needs help", "c-bad"];
}

export function withMsg(path: string, key: "ok" | "err", text: string) {
  return `${path}${path.includes("?") ? "&" : "?"}${key}=${encodeURIComponent(text)}`;
}

export const USERNAME_RE = /^[a-z0-9._]{3,30}$/;
// Students choosing their own username at sign-up.
export const SIGNUP_USERNAME_RE = /^[a-z0-9_]{4,20}$/;
export const MOBILE_RE = /^[6-9]\d{9}$/;

export const ENQUIRY_STATUSES = ["New", "Contacted", "Demo scheduled", "Demo attended", "Admitted", "Lost"] as const;

export const PAY_MODES = ["Cash", "UPI", "Bank transfer", "Cheque"] as const;

export function rupees(n: number) {
  return "₹" + Math.round(n).toLocaleString("en-IN");
}

// Whole rupees only; returns null for anything that is not a positive amount.
export function amount(fd: FormData, k: string) {
  const n = Number(str(fd, k).replace(/[,₹\s]/g, ""));
  return Number.isInteger(n) && n > 0 && n <= 10_000_000 ? n : null;
}
