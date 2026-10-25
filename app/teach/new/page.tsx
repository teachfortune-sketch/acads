import { requireRole, TEACHING } from "@/lib/auth";
import { batchStudents, getBatches, teachableSubjects } from "@/lib/queries";
import { todayIST } from "@/lib/util";
import { Shell } from "@/components/Shell";
import { Flash } from "@/components/Flash";
import { BatchChips } from "@/components/BatchChips";
import { createLecture } from "../actions";

export default async function NewLecturePage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const s = await requireRole(...TEACHING);
  const sp = await searchParams;
  const [batches, subjects] = await Promise.all([getBatches(), teachableSubjects(s)]);
  const batch = batches.find((b) => b.id === Number(sp.batch));
  const students = batch ? await batchStudents(batch.id) : [];
  return (
    <Shell s={s} active="/teach">
      <div>
        <h1>Log a class</h1>
        <p className="muted">Record what you taught, who was present and the homework. Absent students see this under “Classes you missed”.</p>
      </div>
      <Flash sp={sp} />
      <div className="panel stack">
        <b className="small">1. Choose the batch</b>
        <BatchChips batches={batches} current={batch?.id ?? null} base="/teach/new" />
      </div>
      {batch && (
        <div className="panel">
          <form action={createLecture} className="form">
            <input type="hidden" name="batch_id" value={batch.id} />
            <label>
              Subject
              <select id="subject_id" name="subject_id" required>
                {subjects.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
              </select>
            </label>
            <label>
              Date
              <input id="held_on" name="held_on" type="date" defaultValue={todayIST()} required />
            </label>
            <label className="full">
              Topic taught
              <input id="topic" name="topic" required placeholder="e.g. Fractions: adding unlike fractions" />
            </label>
            <label className="full">
              Class notes (what absent students should read)
              <textarea id="notes" name="notes" placeholder="Key points, textbook page numbers, examples solved" />
            </label>
            <label className="full">
              Homework
              <input id="homework" name="homework" placeholder="e.g. Exercise 2.3, Q1 to Q6" />
            </label>
            <div className="full">
              <b className="small">Attendance for {batch.name}</b> <span className="muted small">(untick students who were absent)</span>
              {students.length ? (
                <div className="checks" style={{ marginTop: 6 }}>
                  {students.map((st) => (
                    <label key={st.id}>
                      <input type="checkbox" id={`p_${st.id}`} name={`p_${st.id}`} defaultChecked />
                      {st.name}
                    </label>
                  ))}
                </div>
              ) : (
                <p className="muted">No students in {batch.name} yet. Add them under Logins.</p>
              )}
            </div>
            <div><button className="btn-p" type="submit">Save class</button></div>
          </form>
        </div>
      )}
    </Shell>
  );
}
