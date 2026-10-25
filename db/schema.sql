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
