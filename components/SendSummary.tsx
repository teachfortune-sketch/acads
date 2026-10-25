"use client";
import { markSummarySent } from "@/app/admin/summaries/actions";

// Opens WhatsApp or the SMS app with the message filled in, and records that it was sent.
export function SendSummary({ student, week, mobile, text }: { student: number; week: string; mobile: string; text: string }) {
  const wa = `https://wa.me/91${mobile}?text=${encodeURIComponent(text)}`;
  const sms = `sms:+91${mobile}?&body=${encodeURIComponent(text)}`;
  return (
    <span className="row-actions">
      <a className="btn small btn-mint" href={wa} target="_blank" rel="noreferrer" onClick={() => void markSummarySent(student, week, "whatsapp")}>WhatsApp</a>
      <a className="btn small" href={sms} onClick={() => void markSummarySent(student, week, "sms")}>SMS</a>
    </span>
  );
}
