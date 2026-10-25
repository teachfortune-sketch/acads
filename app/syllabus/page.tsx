import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { teachableSubjects } from "@/lib/queries";
import { viewedBatch } from "@/lib/viewer";
import { classSyllabus, expectedPace, groupBooks } from "@/lib/syllabus";
import { Shell } from "@/components/Shell";
import { BatchChips } from "@/components/BatchChips";
import { toggleTaught } from "./actions";

export default async function SyllabusPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const s = await requireRole();
  const sp = await searchParams;
  const { batches, batch, child, staff } = await viewedBatch(s, sp);
  const chapters = batch ? await classSyllabus(batch.id, batch.name) : [];
  const subjects = [...new Map(chapters.map((c) => [c.subject_id, c.subject])).entries()];
  const subjectId = subjects.find(([id]) => id === Number(sp.subject))?.[0] ?? subjects[0]?.[0];
  const mine = staff ? new Set((await teachableSubjects(s)).map((x) => x.id)) : new Set<number>();
  const canTick = staff && s.role !== "reception" && mine.has(subjectId ?? -1);
  const shown = chapters.filter((c) => c.subject_id === subjectId);
  const pace = Math.round(expectedPace() * 100);
  const q = (extra: Record<string, string | number>) =>
    "/syllabus?" + new URLSearchParams({ ...(staff && batch ? { batch: String(batch.id) } : {}), ...(child ? { child: String(child) } : {}), ...Object.fromEntries(Object.entries(extra).map(([k, v]) => [k, String(v)])) });
  return (
    <Shell s={s} active="/syllabus" child={child}>
      <div>
        <h1>Syllabus{batch ? `: ${batch.name}` : ""}</h1>
        <p className="muted">NCERT books for this session. Chapters are ticked as your teachers finish them.</p>
      </div>
      {staff && <BatchChips batches={batches} current={batch?.id ?? null} base="/syllabus" />}
      {!chapters.length ? (
        <div className="panel"><p className="muted">No NCERT syllabus is loaded for this class.</p></div>
      ) : (
        <>
          <div className="syltabs" role="tablist" aria-label="Subjects">
            {subjects.map(([id, name]) => {
              const all = chapters.filter((c) => c.subject_id === id);
              return (
                <Link key={id} role="tab" href={q({ subject: id })} aria-selected={id === subjectId}>
                  {name} <small className="num">{all.filter((c) => c.taught).length}/{all.length}</small>
                </Link>
              );
            })}
          </div>
          {staff && (
            <p className="small muted">
              By now about <b className="num">{pace}%</b> of each book should be taught (April to February).
              {canTick ? " Tap a chapter to mark it taught; tap again to undo." : s.role === "reception" ? "" : " You can tick chapters only for subjects you teach."}
            </p>
          )}
          <div className="books">
            {groupBooks(shown).map((b) => {
              const done = b.chapters.filter((c) => c.taught).length;
              let unit = "";
              return (
                <article key={b.book} className="panel book">
                  <header>
                    <h2>{b.book}</h2>
                    <span className="small num">{done} / {b.chapters.length} taught</span>
                  </header>
                  <div className="xpbar thin" aria-hidden><span style={{ width: `${(done / b.chapters.length) * 100}%` }} /></div>
                  <ol className="chs">
                    {b.chapters.map((c) => {
                      const head = c.unit && c.unit !== unit ? <li className="unit">{c.unit}</li> : null;
                      unit = c.unit;
                      return (
                        <ChapterRow key={c.id} head={head} no={c.no} name={c.name} taught={c.taught} by={c.taught_by}
                          tick={canTick && batch ? { batch: batch.id, chapter: c.id } : null} />
                      );
                    })}
                  </ol>
                </article>
              );
            })}
          </div>
        </>
      )}
    </Shell>
  );
}

function ChapterRow({ head, no, name, taught, by, tick }: { head: React.ReactNode; no: number; name: string; taught: boolean; by: string | null; tick: { batch: number; chapter: number } | null }) {
  return (
    <>
      {head}
      <li className={taught ? "taught" : ""}>
        <span className="no num">{no}</span>
        <span className="nm">{name}</span>
        {tick ? (
          <form action={toggleTaught}>
            <input type="hidden" name="batch_id" value={tick.batch} />
            <input type="hidden" name="chapter_id" value={tick.chapter} />
            <button type="submit" className={`small ${taught ? "btn-mint" : ""}`} title={taught && by ? `Ticked by ${by}` : undefined}>{taught ? "Taught ✓" : "Mark taught"}</button>
          </form>
        ) : taught ? <span className="chip c-good">Taught</span> : null}
      </li>
    </>
  );
}
