-- Acads database schema. Safe to run more than once.

create table if not exists users (
  id serial primary key,
  username text not null unique,
  password_hash text not null,
  name text not null,
  role text not null check (role in ('admin','teacher','student','parent')),
  active boolean not null default true,
  session_version integer not null default 1,
  created_at timestamptz not null default now()
);

create table if not exists batches (
  id serial primary key,
  name text not null unique,
  sort integer not null default 0
);

create table if not exists subjects (
  id serial primary key,
  name text not null unique,
  sort integer not null default 0
);

-- Which subjects each teacher teaches (in every batch).
create table if not exists teacher_subjects (
  teacher_id integer not null references users(id) on delete cascade,
  subject_id integer not null references subjects(id) on delete cascade,
  primary key (teacher_id, subject_id)
);

create table if not exists students (
  user_id integer primary key references users(id) on delete cascade,
  batch_id integer not null references batches(id),
  parent_id integer references users(id) on delete set null,
  joined_on date not null default current_date
);

create table if not exists lectures (
  id serial primary key,
  batch_id integer not null references batches(id),
  subject_id integer not null references subjects(id),
  teacher_id integer not null references users(id),
  held_on date not null,
  topic text not null,
  notes text not null default '',
  homework text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists lectures_batch_idx on lectures (batch_id, held_on desc);

-- One row per student who was in the batch when the class was logged.
create table if not exists attendance (
  lecture_id integer not null references lectures(id) on delete cascade,
  student_id integer not null references users(id) on delete cascade,
  present boolean not null,
  homework_done boolean not null default false,
  primary key (lecture_id, student_id)
);
create index if not exists attendance_student_idx on attendance (student_id);

create table if not exists exams (
  id serial primary key,
  batch_id integer not null references batches(id),
  subject_id integer not null references subjects(id),
  teacher_id integer not null references users(id),
  title text not null,
  topic text not null default '',
  held_on date not null,
  max_marks numeric not null check (max_marks > 0),
  created_at timestamptz not null default now()
);

-- marks is null when the student was absent for the test.
create table if not exists exam_marks (
  exam_id integer not null references exams(id) on delete cascade,
  student_id integer not null references users(id) on delete cascade,
  marks numeric,
  primary key (exam_id, student_id)
);

-- A notice goes to everyone (both null), one batch, or one student.
create table if not exists notices (
  id serial primary key,
  author_id integer not null references users(id),
  batch_id integer references batches(id) on delete cascade,
  student_id integer references users(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

create table if not exists remarks (
  id serial primary key,
  student_id integer not null references users(id) on delete cascade,
  subject_id integer references subjects(id),
  author_id integer not null references users(id),
  body text not null,
  created_at timestamptz not null default now()
);

-- Planned classes and tests. Once the class is logged or marks entered, it links to them.
create table if not exists schedule (
  id serial primary key,
  kind text not null check (kind in ('class','test')),
  batch_id integer not null references batches(id),
  subject_id integer not null references subjects(id),
  teacher_id integer not null references users(id),
  planned_on date not null,
  start_time text not null default '',
  topic text not null,
  prerequisites text not null default '',
  lecture_id integer references lectures(id) on delete set null,
  exam_id integer references exams(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists schedule_batch_idx on schedule (batch_id, planned_on);

-- Work a teacher gives to some or all students of a batch, usually after a class.
create table if not exists tasks (
  id serial primary key,
  lecture_id integer references lectures(id) on delete set null,
  batch_id integer not null references batches(id),
  subject_id integer not null references subjects(id),
  teacher_id integer not null references users(id),
  title text not null,
  details text not null default '',
  due_on date,
  created_at timestamptz not null default now()
);
create table if not exists task_students (
  task_id integer not null references tasks(id) on delete cascade,
  student_id integer not null references users(id) on delete cascade,
  done boolean not null default false,
  primary key (task_id, student_id)
);

-- Numbered worksheets. Assigned to every student of the batch.
create table if not exists sheets (
  id serial primary key,
  number integer not null unique,
  title text not null,
  batch_id integer not null references batches(id),
  subject_id integer references subjects(id),
  body text not null default '',
  due_on date,
  created_at timestamptz not null default now()
);
create table if not exists sheet_students (
  sheet_id integer not null references sheets(id) on delete cascade,
  student_id integer not null references users(id) on delete cascade,
  done boolean not null default false,
  primary key (sheet_id, student_id)
);

-- Private notes on a student's behaviour. Only the admin sees these.
create table if not exists behaviour_notes (
  id serial primary key,
  student_id integer not null references users(id) on delete cascade,
  author_id integer not null references users(id),
  note text not null,
  advice text not null default '',
  created_at timestamptz not null default now()
);

-- Admission enquiries from the public website.
create table if not exists enquiries (
  id serial primary key,
  guardian_name text not null,
  student_name text not null default '',
  class_level text not null default '',
  phone text not null,
  message text not null default '',
  source text not null default 'website',
  status text not null default 'New'
    check (status in ('New','Contacted','Demo scheduled','Demo attended','Admitted','Lost')),
  next_follow_up date,
  notes text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists enquiries_status_idx on enquiries (status, created_at desc);

-- Fees. A plan is split into installments (what is due and when).
-- Payments and concessions are never deleted: a mistake is reversed with a reason.
create table if not exists fee_plans (
  id serial primary key,
  student_id integer not null references users(id) on delete cascade,
  title text not null,
  created_by integer not null references users(id),
  created_at timestamptz not null default now(),
  cancelled_at timestamptz,
  cancelled_by integer references users(id),
  cancel_reason text not null default ''
);
create table if not exists fee_installments (
  id serial primary key,
  plan_id integer not null references fee_plans(id) on delete cascade,
  due_on date not null,
  amount integer not null check (amount > 0)
);
create table if not exists fee_payments (
  id serial primary key,
  receipt_no integer not null unique,
  student_id integer not null references users(id) on delete cascade,
  amount integer not null check (amount > 0),
  paid_on date not null,
  mode text not null check (mode in ('Cash','UPI','Bank transfer','Cheque')),
  reference text not null default '',
  note text not null default '',
  form_token text unique,
  created_by integer not null references users(id),
  created_at timestamptz not null default now(),
  reversed_at timestamptz,
  reversed_by integer references users(id),
  reversal_reason text not null default ''
);
create table if not exists fee_concessions (
  id serial primary key,
  student_id integer not null references users(id) on delete cascade,
  amount integer not null check (amount > 0),
  reason text not null,
  created_by integer not null references users(id),
  created_at timestamptz not null default now(),
  reversed_at timestamptz,
  reversed_by integer references users(id),
  reversal_reason text not null default ''
);
create index if not exists fee_plans_student_idx on fee_plans (student_id);
create index if not exists fee_payments_student_idx on fee_payments (student_id);
create index if not exists fee_concessions_student_idx on fee_concessions (student_id);

-- ── Questboard ─────────────────────────────────────────────────────────────
-- Reception is a staff role. Students can sign up and wait for approval.
alter table users drop constraint if exists users_role_check;
alter table users add constraint users_role_check check (role in ('admin','teacher','reception','student','parent'));
alter table users add column if not exists status text not null default 'approved';
alter table users drop constraint if exists users_status_check;
alter table users add constraint users_status_check check (status in ('pending','approved','rejected'));
alter table users add column if not exists reject_reason text not null default '';
alter table users add column if not exists must_change_password boolean not null default false;
alter table users add column if not exists failed_logins integer not null default 0;
alter table users add column if not exists locked_until timestamptz;

alter table students add column if not exists school text not null default '';
alter table students add column if not exists section text not null default '';
alter table students add column if not exists roll_no text not null default '';
alter table students add column if not exists parent_name text not null default '';
alter table students add column if not exists parent_mobile text not null default '';

-- "Forgot password" requests wait here until an admin sets a temporary password.
create table if not exists reset_requests (
  id serial primary key,
  user_id integer not null references users(id) on delete cascade,
  note text not null default '',
  created_at timestamptz not null default now(),
  handled_at timestamptz,
  handled_by integer references users(id)
);

-- Point values, caps and cut-offs the admin can change. Missing keys use the defaults in lib/points.ts.
create table if not exists point_rules (
  key text primary key,
  value text not null
);

-- One attendance status per student per day (reception's late flag lands here too).
create table if not exists day_attendance (
  student_id integer not null references users(id) on delete cascade,
  day date not null,
  batch_id integer not null references batches(id),
  status text not null check (status in ('present','late','absent','excused')),
  arrived_at text not null default '',
  marked_by integer not null references users(id),
  updated_at timestamptz not null default now(),
  primary key (student_id, day)
);
create index if not exists day_attendance_batch_idx on day_attendance (batch_id, day);

-- The day's homework quest: one per batch per day, due on due_on.
create table if not exists quests (
  id serial primary key,
  batch_id integer not null references batches(id),
  subject_id integer not null references subjects(id),
  due_on date not null,
  book text not null default '',
  chapter text not null default '',
  exercise text not null default '',
  questions text not null default '',
  note text not null default '',
  lecture_id integer references lectures(id) on delete set null,
  posted_by integer not null references users(id),
  created_at timestamptz not null default now(),
  unique (batch_id, due_on)
);

-- How each student did on a quest, checked by hand in class.
create table if not exists quest_checks (
  quest_id integer not null references quests(id) on delete cascade,
  student_id integer not null references users(id) on delete cascade,
  done boolean not null,
  stars integer not null default 0 check (stars between 0 and 3),
  bonus integer not null default 0 check (bonus between 0 and 100),
  checked_by integer not null references users(id),
  checked_at timestamptz not null default now(),
  primary key (quest_id, student_id)
);

-- Every point change. Never edited or deleted: a reversal is a new row pointing at the original.
create table if not exists points (
  id serial primary key,
  student_id integer not null references users(id) on delete cascade,
  pillar text not null check (pillar in ('homework','attendance','presence','discipline','selfstudy')),
  action text not null,
  xp integer not null,
  reason text not null,
  note text not null default '',
  staff_id integer references users(id),
  quest_id integer references quests(id) on delete set null,
  day date not null,
  client_id text unique,
  created_at timestamptz not null default now(),
  reverses_id integer references points(id),
  reversed_by_id integer references points(id)
);
create index if not exists points_student_idx on points (student_id, created_at desc);
create index if not exists points_day_idx on points (day);

create table if not exists app_state (
  key text primary key,
  value text not null
);

-- Actions sent from class mode and the reception desk carry an id, so a retry after a bad connection is not counted twice.
create table if not exists client_actions (
  id text primary key,
  done_at timestamptz not null default now()
);

-- ── Questboard phase 2: syllabus, planner, self-study, badges ──

-- NCERT chapters, loaded each session from db/syllabus-<session>.json. Past quests keep their own text labels.
create table if not exists syllabus_chapters (
  id serial primary key,
  session text not null,
  grade integer not null check (grade between 6 and 10),
  subject_id integer not null references subjects(id),
  book text not null,
  unit text not null default '',
  no integer not null,
  name text not null,
  sort integer not null default 0,
  unique (session, grade, subject_id, book, no)
);
create index if not exists syllabus_grade_idx on syllabus_chapters (grade, subject_id, sort);

-- A chapter ticked as taught for one class.
create table if not exists taught_marks (
  batch_id integer not null references batches(id) on delete cascade,
  chapter_id integer not null references syllabus_chapters(id) on delete cascade,
  teacher_id integer references users(id),
  at timestamptz not null default now(),
  primary key (batch_id, chapter_id)
);

alter table quests add column if not exists chapter_id integer references syllabus_chapters(id) on delete set null;

-- A student's weekly routine: study blocks by weekday (0 = Monday).
create table if not exists routine_blocks (
  id serial primary key,
  student_id integer not null references users(id) on delete cascade,
  weekday integer not null check (weekday between 0 and 6),
  starts text not null,
  ends text not null,
  subject_id integer references subjects(id),
  note text not null default ''
);
create index if not exists routine_student_idx on routine_blocks (student_id, weekday, starts);

-- Self-study tasks a student plans; shared ones show up for that subject's teacher in class mode.
create table if not exists study_tasks (
  id serial primary key,
  student_id integer not null references users(id) on delete cascade,
  subject_id integer not null references subjects(id),
  chapter_id integer references syllabus_chapters(id) on delete set null,
  text text not null,
  shared boolean not null default true,
  done_at timestamptz,
  verdict text check (verdict in ('verified','great')),
  verified_by integer references users(id),
  verified_at timestamptz,
  comment text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists study_tasks_student_idx on study_tasks (student_id, created_at desc);

alter table points add column if not exists task_id integer references study_tasks(id) on delete set null;
alter table points add column if not exists subject_id integer references subjects(id);

-- Days a student followed their own routine, confirmed by a teacher at the weekly self-study check.
create table if not exists routine_checks (
  student_id integer not null references users(id) on delete cascade,
  week_start date not null,
  days integer not null check (days between 0 and 6),
  checked_by integer references users(id),
  at timestamptz not null default now(),
  primary key (student_id, week_start)
);

-- Badges that depend on a moment in time (Podium Finish) are stored when the week is settled; the rest are computed.
create table if not exists badge_awards (
  student_id integer not null references users(id) on delete cascade,
  badge text not null,
  earned_on date not null,
  primary key (student_id, badge)
);

-- ── Questboard phase 3: TV display and weekly parent summary ──

-- A private link for a classroom or reception TV. No login; the admin can turn it off at any time.
create table if not exists display_links (
  id serial primary key,
  token text not null unique,
  label text not null,
  batch_id integer references batches(id) on delete cascade,
  created_by integer references users(id),
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);

-- Which weekly parent summaries have been sent, so the office can see who is left.
create table if not exists parent_summaries (
  student_id integer not null references users(id) on delete cascade,
  week_start date not null,
  channel text not null check (channel in ('whatsapp','sms')),
  sent_by integer references users(id),
  at timestamptz not null default now(),
  primary key (student_id, week_start)
);
