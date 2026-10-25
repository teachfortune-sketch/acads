import { requireRole, TEACHING } from "@/lib/auth";
import { batchStudents, getBatches, teachableSubjects } from "@/lib/queries";
import { todayIST } from "@/lib/util";
import { Shell } from "@/components/Shell";
import { Flash } from "@/components/Flash";
import { BatchChips } from "@/components/BatchChips";
import { createExam } from "../../actions";

export default async function NewExamPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const s = await requireRole(...TEACHING);
  const sp = await searchParams;
  const [batches, subjects] = await Promise.all([getBatches(), teachableSubjects(s)]);
  const batch = batches.find((b) => b.id === Number(sp.batch));
  const students = batch ? await batchStudents(batch.id) : [];
  return (
    <Shell s={s} active="/teach/exams">
      <div><h1>Enter test marks</h1><p className="muted">Leave a box empty if the student was absent for the test.</p></div>
      <Flash sp={sp} />
      <div className="panel stack">
        <b className="small">1. Choose the batch</b>
        <BatchChips batches={batches} current={batch?.id ?? null} base="/teach/exams/new" />
      </div>
      {batch && (
        <div className="panel">
          <form action={createExam} className="form">
            <input type="hidden" name="batch_id" value={batch.id} />
            <label>Subject
              <select id="subject_id" name="subject_id" required>
                {subjects.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
              </select>
            </label>
            <label>Test name<input id="title" name="title" defaultValue="Weekly test" required /></label>
            <label>Date<input id="held_on" name="held_on" type="date" defaultValue={todayIST()} required /></label>
            <label>Total marks<input id="max_marks" name="max_marks" type="number" min="1" step="any" defaultValue="25" required /></label>
            <label className="full">Topics in this test<input id="topic" name="topic" placeholder="e.g. Integers, fractions" /></label>
            <div className="full checks">
              {students.map((st) => (
                <label key={st.id} style={{ justifyContent: "space-between" }}>
                  {st.name}
                  <input id={`m_${st.id}`} name={`m_${st.id}`} type="number" min="0" step="any" style={{ width: 80 }} aria-label={`Marks for ${st.name}`} />
                </label>
              ))}
            </div>
            {!students.length && <p className="muted full">No students in {batch.name} yet.</p>}
            <div><button className="btn-p" type="submit">Save marks</button></div>
          </form>
        </div>
      )}
    </Shell>
  );
}
