import Link from "next/link";
import { requireRole, TEACHING } from "@/lib/auth";
import { sql } from "@/lib/db";
import { getBatches, teachableSubjects } from "@/lib/queries";
import { todayIST } from "@/lib/util";
import { Shell } from "@/components/Shell";
import { Flash } from "@/components/Flash";
import { BatchChips } from "@/components/BatchChips";
import { startClass } from "./actions";

export default async function ClassModeStart({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const s = await requireRole(...TEACHING);
  const sp = await searchParams;
  const [batches, subjects] = await Promise.all([getBatches(), teachableSubjects(s)]);
  const batch = batches.find((b) => b.id === Number(sp.batch));
  const today = await sql`
    select l.id, l.topic, b.name as batch, sub.name as subject, u.name as teacher
    from lectures l join batches b on b.id = l.batch_id join subjects sub on sub.id = l.subject_id join users u on u.id = l.teacher_id
    where l.held_on = ${todayIST()} and l.subject_id = any(${subjects.map((x) => x.id)}) order by l.created_at desc`;
  return (
    <Shell s={s} active="/class">
      <div>
        <h1>Class mode</h1>
        <p className="muted">Attendance, homework stars and presence points while you teach. Pick the batch, then your subject.</p>
      </div>
      <Flash sp={sp} />
      {today.length > 0 && (
        <div className="panel">
          <h2>Today&apos;s classes</h2>
          <ul className="list">
            {today.map((l) => (
              <li key={l.id}>
                <div><b>{l.batch} · {l.subject}</b><div className="muted small">{l.topic} · {l.teacher}</div></div>
                <Link className="btn small btn-p" href={`/class/${l.id}`}>Open</Link>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="panel stack">
        <b className="small">1. Batch</b>
        <BatchChips batches={batches} current={batch?.id ?? null} base="/class" />
        {batch && (
          <>
            <b className="small">2. Start the class</b>
            {subjects.length ? (
              <div className="row-actions">
                {subjects.map((x) => (
                  <form key={x.id} action={startClass}>
                    <input type="hidden" name="batch_id" value={batch.id} />
                    <input type="hidden" name="subject_id" value={x.id} />
                    <button className="btn-p" type="submit">{batch.name} · {x.name}</button>
                  </form>
                ))}
              </div>
            ) : <p className="muted">You have no subjects yet. Ask the admin to assign them under Logins.</p>}
            <p className="muted small">Starting marks everyone present who isn&apos;t already marked late by reception. Tap to change it in class.</p>
          </>
        )}
      </div>
    </Shell>
  );
}
