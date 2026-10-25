import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole, TEACHING } from "@/lib/auth";
import { sql } from "@/lib/db";
import { canTeach } from "@/lib/queries";
import { fmtDate } from "@/lib/util";
import { Shell } from "@/components/Shell";
import { Flash } from "@/components/Flash";
import { deletePlan, updatePlan } from "../../plan-actions";

export default async function PlanPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string>> }) {
  const s = await requireRole(...TEACHING);
  const sp = await searchParams;
  const [p] = await sql`
    select p.*, p.planned_on::text as date, sub.name as subject, b.name as batch, t.name as teacher
    from schedule p join subjects sub on sub.id = p.subject_id join batches b on b.id = p.batch_id join users t on t.id = p.teacher_id
    where p.id = ${Number((await params).id) || 0}`;
  if (!p) notFound();
  const editable = await canTeach(s, p.subject_id);
  const isTest = p.kind === "test";
  return (
    <Shell s={s} active="/teach/calendar">
      <div><Link href={`/teach/calendar?month=${p.date.slice(0, 7)}`} className="btn small">← Calendar</Link></div>
      <div>
        <h1>{isTest ? "Test" : "Class"}: {p.subject}, {p.topic}</h1>
        <p className="muted">{p.batch} · {fmtDate(p.date)}{p.start_time ? ` at ${p.start_time}` : ""} · planned by {p.teacher}</p>
      </div>
      <Flash sp={sp} />
      {p.lecture_id || p.exam_id ? (
        <div className="ok">
          Done. <Link href={p.lecture_id ? `/teach/lectures/${p.lecture_id}` : `/teach/exams/${p.exam_id}`}>Open the {isTest ? "marks" : "class record"}</Link>
        </div>
      ) : (
        editable && (
          <div className="row-actions">
            <Link className="btn btn-p" href={isTest ? `/teach/exams/new?batch=${p.batch_id}&plan=${p.id}` : `/teach/new?batch=${p.batch_id}&plan=${p.id}`}>
              {isTest ? "Enter marks for this test" : "Log this class"}
            </Link>
          </div>
        )
      )}
      <form action={updatePlan}>
        <input type="hidden" name="id" value={p.id} />
        <fieldset disabled={!editable} className="panel form" style={{ margin: 0 }}>
          <label>Date<input id="planned_on" name="planned_on" type="date" defaultValue={p.date} required /></label>
          <label>Time<input id="start_time" name="start_time" type="time" defaultValue={p.start_time} /></label>
          <label className="full">Topic<input id="topic" name="topic" defaultValue={p.topic} required /></label>
          <label className="full">Prerequisites<textarea id="prerequisites" name="prerequisites" defaultValue={p.prerequisites} /></label>
          {editable && <div><button className="btn-p" type="submit">Save</button></div>}
        </fieldset>
      </form>
      {editable && (
        <form action={deletePlan}>
          <input type="hidden" name="id" value={p.id} />
          <details><summary className="muted small">Remove from calendar</summary><button className="btn-danger" type="submit">Yes, remove it</button></details>
        </form>
      )}
    </Shell>
  );
}
