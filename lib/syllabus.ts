import { sql } from "./db";
import { gradeOf } from "./books";
import { todayIST } from "./util";

// The NCERT session runs April to March. Chapters are loaded per session from db/syllabus-<session>.json.
export function sessionOf(day = todayIST()) {
  const [y, m] = day.split("-").map(Number);
  const start = m >= 4 ? y : y - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, "0")}`;
}

// The current session if it is loaded, otherwise the latest one that is.
export async function activeSession() {
  const want = sessionOf();
  const [r] = await sql`select session from syllabus_chapters group by session order by (session = ${want}) desc, session desc limit 1`;
  return (r?.session as string) ?? want;
}

export type Chapter = { id: number; subject_id: number; subject: string; book: string; unit: string; no: number; name: string; taught: boolean; taught_by: string | null };

// Every chapter for a class, with whether it has been taught to that batch.
export async function classSyllabus(batchId: number, batchName: string) {
  const grade = gradeOf(batchName);
  if (!grade) return [];
  const session = await activeSession();
  return sql<Chapter[]>`
    select c.id, c.subject_id, sub.name as subject, c.book, c.unit, c.no, c.name,
      t.chapter_id is not null as taught, u.name as taught_by
    from syllabus_chapters c join subjects sub on sub.id = c.subject_id
    left join taught_marks t on t.chapter_id = c.id and t.batch_id = ${batchId}
    left join users u on u.id = t.teacher_id
    where c.session = ${session} and c.grade = ${grade}
    order by sub.sort, c.sort`;
}

export function groupBooks(chapters: Chapter[]) {
  const books: { book: string; chapters: Chapter[] }[] = [];
  for (const c of chapters) {
    const last = books[books.length - 1];
    if (last?.book === c.book) last.chapters.push(c);
    else books.push({ book: c.book, chapters: [c] });
  }
  return books;
}

export function chapterLabel(c: { book: string; no: number; name: string }) {
  return `NCERT ${c.book.replace(/ – Part \d/, "")} · Ch ${c.no} · ${c.name}`;
}

// How far through the session a class should be: teaching runs April to the end of February, March is exams.
export function expectedPace(day = todayIST()) {
  const session = sessionOf(day);
  const start = Date.parse(`${session.slice(0, 4)}-04-01`);
  const end = Date.parse(`${Number(session.slice(0, 4)) + 1}-03-01`);
  return Math.max(0, Math.min(1, (Date.parse(day) - start) / (end - start)));
}

// Taught counts per class and subject, for the admin pace report.
export async function paceReport() {
  const session = await activeSession();
  return sql<{ batch_id: number; batch: string; subject: string; total: number; taught: number }[]>`
    select b.id as batch_id, b.name as batch, sub.name as subject, count(c.id)::int as total, count(t.chapter_id)::int as taught
    from batches b
    join syllabus_chapters c on c.session = ${session} and c.grade = nullif(substring(b.name from '\\d+'), '')::int
    join subjects sub on sub.id = c.subject_id
    left join taught_marks t on t.chapter_id = c.id and t.batch_id = b.id
    group by b.id, b.name, b.sort, sub.name, sub.sort order by b.sort, sub.sort`;
}
