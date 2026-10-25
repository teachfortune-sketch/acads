import { sql } from "./db";
import { Session } from "./auth";

export type Batch = { id: number; name: string };
export type Subject = { id: number; name: string };

export const getBatches = () => sql<Batch[]>`select id, name from batches order by sort`;
export const getSubjects = () => sql<Subject[]>`select id, name from subjects order by sort`;

// Admin can teach any subject; a teacher only the subjects assigned to them.
export async function teachableSubjects(s: Session) {
  if (s.role === "admin") return getSubjects();
  return sql<Subject[]>`
    select sub.id, sub.name from subjects sub
    join teacher_subjects ts on ts.subject_id = sub.id and ts.teacher_id = ${s.uid}
    order by sub.sort`;
}

export async function canTeach(s: Session, subjectId: number) {
  return (await teachableSubjects(s)).some((x) => x.id === subjectId);
}

export const batchStudents = (batchId: number) =>
  sql<{ id: number; name: string }[]>`
    select u.id, u.name from students st join users u on u.id = st.user_id
    where st.batch_id = ${batchId} and u.active order by u.name`;

export type StudentInfo = { id: number; name: string; username: string; batch_id: number; batch: string; parent_id: number | null; parent: string | null };
export async function getStudent(id: number) {
  const [s] = await sql<StudentInfo[]>`
    select u.id, u.name, u.username, st.batch_id, b.name as batch, st.parent_id, p.name as parent
    from students st join users u on u.id = st.user_id join batches b on b.id = st.batch_id
    left join users p on p.id = st.parent_id
    where st.user_id = ${id}`;
  return s ?? null;
}

export type SubjectStats = { subject_id: number; subject: string; classes: number; present: number; hw_total: number; hw_done: number; score: number | null; tests: number };

export async function subjectStats(studentId: number) {
  const rows = await sql<SubjectStats[]>`
    select sub.id as subject_id, sub.name as subject,
      coalesce(a.classes, 0)::int as classes, coalesce(a.present, 0)::int as present,
      coalesce(a.hw_total, 0)::int as hw_total, coalesce(a.hw_done, 0)::int as hw_done,
      e.score::float as score, coalesce(e.tests, 0)::int as tests
    from subjects sub
    left join (
      select l.subject_id, count(*) as classes, count(*) filter (where at.present) as present,
        count(*) filter (where l.homework <> '') as hw_total,
        count(*) filter (where l.homework <> '' and at.homework_done) as hw_done
      from attendance at join lectures l on l.id = at.lecture_id
      where at.student_id = ${studentId} group by l.subject_id
    ) a on a.subject_id = sub.id
    left join (
      select ex.subject_id, avg(m.marks / ex.max_marks) as score, count(*) as tests
      from exam_marks m join exams ex on ex.id = m.exam_id
      where m.student_id = ${studentId} and m.marks is not null group by ex.subject_id
    ) e on e.subject_id = sub.id
    order by sub.sort`;
  return rows;
}

export function totals(rows: SubjectStats[]) {
  const sum = (k: keyof SubjectStats) => rows.reduce((a, r) => a + (r[k] as number), 0);
  const classes = sum("classes"), hwTotal = sum("hw_total"), tests = sum("tests");
  const scored = rows.filter((r) => r.score != null);
  return {
    att: classes ? sum("present") / classes : null,
    hw: hwTotal ? sum("hw_done") / hwTotal : null,
    score: tests ? scored.reduce((a, r) => a + r.score! * r.tests, 0) / tests : null,
  };
}

export type LectureRow = { id: number; held_on: string; subject: string; topic: string; notes: string; homework: string; teacher: string; present: boolean; homework_done: boolean };

export const studentLectures = (studentId: number, onlyMissed = false, limit = 200) =>
  sql<LectureRow[]>`
    select l.id, l.held_on::text, sub.name as subject, l.topic, l.notes, l.homework, t.name as teacher, at.present, at.homework_done
    from attendance at join lectures l on l.id = at.lecture_id
    join subjects sub on sub.id = l.subject_id join users t on t.id = l.teacher_id
    where at.student_id = ${studentId} ${onlyMissed ? sql`and not at.present` : sql``}
    order by l.held_on desc, l.id desc limit ${limit}`;

export const pendingHomework = (studentId: number) =>
  sql<LectureRow[]>`
    select l.id, l.held_on::text, sub.name as subject, l.topic, l.notes, l.homework, t.name as teacher, at.present, at.homework_done
    from attendance at join lectures l on l.id = at.lecture_id
    join subjects sub on sub.id = l.subject_id join users t on t.id = l.teacher_id
    where at.student_id = ${studentId} and l.homework <> '' and not at.homework_done
      and l.held_on >= current_date - 30
    order by l.held_on desc`;

export type NoticeRow = { id: number; body: string; created_at: Date; author: string; target: string };

export const noticesForStudent = (studentId: number, batchId: number) =>
  sql<NoticeRow[]>`
    select n.id, n.body, n.created_at, u.name as author,
      case when n.student_id is not null then 'Only you' when n.batch_id is not null then b.name else 'Everyone' end as target
    from notices n join users u on u.id = n.author_id left join batches b on b.id = n.batch_id
    where (n.batch_id is null and n.student_id is null) or n.batch_id = ${batchId} or n.student_id = ${studentId}
    order by n.created_at desc limit 30`;

export type RemarkRow = { id: number; body: string; created_at: Date; author: string; subject: string | null };
export const remarksFor = (studentId: number) =>
  sql<RemarkRow[]>`
    select r.id, r.body, r.created_at, u.name as author, sub.name as subject
    from remarks r join users u on u.id = r.author_id left join subjects sub on sub.id = r.subject_id
    where r.student_id = ${studentId} order by r.created_at desc limit 30`;

export type ExamRow = { id: number; title: string; topic: string; held_on: string; subject: string; max_marks: number; marks: number | null };
export const studentExams = (studentId: number) =>
  sql<ExamRow[]>`
    select ex.id, ex.title, ex.topic, ex.held_on::text, sub.name as subject, ex.max_marks::float, m.marks::float
    from exam_marks m join exams ex on ex.id = m.exam_id join subjects sub on sub.id = ex.subject_id
    where m.student_id = ${studentId} order by ex.held_on desc`;

export type PlanRow = { id: number; kind: "class" | "test"; planned_on: string; start_time: string; topic: string; prerequisites: string; subject: string; batch: string; teacher: string; lecture_id: number | null; exam_id: number | null };

export const upcomingForBatch = (batchId: number, days = 14) =>
  sql<PlanRow[]>`
    select p.id, p.kind, p.planned_on::text, p.start_time, p.topic, p.prerequisites, sub.name as subject, b.name as batch, t.name as teacher, p.lecture_id, p.exam_id
    from schedule p join subjects sub on sub.id = p.subject_id join batches b on b.id = p.batch_id join users t on t.id = p.teacher_id
    where p.batch_id = ${batchId} and p.planned_on >= current_date and p.planned_on <= current_date + ${days}::int
      and p.lecture_id is null and p.exam_id is null
    order by p.planned_on, p.start_time`;

export type TaskRow = { id: number; title: string; details: string; due_on: string | null; subject: string; teacher: string; done: boolean; topic: string | null };
export const studentTasks = (studentId: number) =>
  sql<TaskRow[]>`
    select t.id, t.title, t.details, t.due_on::text, sub.name as subject, u.name as teacher, ts.done, l.topic
    from task_students ts join tasks t on t.id = ts.task_id join subjects sub on sub.id = t.subject_id
    join users u on u.id = t.teacher_id left join lectures l on l.id = t.lecture_id
    where ts.student_id = ${studentId}
    order by ts.done, t.due_on nulls last, t.created_at desc limit 50`;

export type SheetRow = { id: number; number: number; title: string; due_on: string | null; subject: string | null; done: boolean };
export const studentSheets = (studentId: number) =>
  sql<SheetRow[]>`
    select s.id, s.number, s.title, s.due_on::text, sub.name as subject, ss.done
    from sheet_students ss join sheets s on s.id = ss.sheet_id left join subjects sub on sub.id = s.subject_id
    where ss.student_id = ${studentId}
    order by ss.done, s.number desc limit 50`;
