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
