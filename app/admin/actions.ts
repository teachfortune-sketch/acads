"use server";
import bcrypt from "bcryptjs";
import type postgres from "postgres";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { sql } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { int, str, USERNAME_RE, withMsg } from "@/lib/util";

type Tx = postgres.TransactionSql;

function checkLogin(username: string, password: string, back: string, who = "") {
  if (!USERNAME_RE.test(username))
    redirect(withMsg(back, "err", `${who}Username must be 3–30 characters: small letters, numbers, dot or underscore.`));
  if (password.length < 6) redirect(withMsg(back, "err", `${who}Password must be at least 6 characters.`));
}

async function insertUser(tx: Tx, name: string, username: string, password: string, role: string) {
  const [u] = await tx`
    insert into users (username, password_hash, name, role)
    values (${username}, ${await bcrypt.hash(password, 10)}, ${name}, ${role})
    on conflict (username) do nothing returning id`;
  return u?.id as number | undefined;
}

export async function createStudent(fd: FormData) {
  await requireRole("admin");
  const back = "/admin/people";
  const name = str(fd, "name"), username = str(fd, "username").toLowerCase(), password = str(fd, "password");
  const batchId = int(fd, "batch_id");
  if (!name || !batchId) redirect(withMsg(back, "err", "Fill in the student's name and batch."));
  checkLogin(username, password, back);
  const parentMode = str(fd, "parent_mode");
  const pName = str(fd, "parent_name"), pUser = str(fd, "parent_username").toLowerCase(), pPass = str(fd, "parent_password");
  if (parentMode === "new") {
    if (!pName) redirect(withMsg(back, "err", "Fill in the parent's name."));
    checkLogin(pUser, pPass, back, "Parent: ");
  }
  const result = await sql.begin(async (tx) => {
    const sid = await insertUser(tx, name, username, password, "student");
    if (!sid) return `The username “${username}” is already taken.`;
    let parentId: number | null = parentMode === "existing" ? int(fd, "parent_id") : null;
    if (parentMode === "new") {
      parentId = (await insertUser(tx, pName, pUser, pPass, "parent")) ?? null;
      if (!parentId) throw new Error(`The username “${pUser}” is already taken.`);
    }
    await tx`insert into students (user_id, batch_id, parent_id) values (${sid}, ${batchId}, ${parentId})`;
    await tx`insert into sheet_students (sheet_id, student_id) select id, ${sid} from sheets where batch_id = ${batchId}`;
    return null;
  }).catch((e: Error) => e.message);
  if (result) redirect(withMsg(back, "err", result));
  revalidatePath("/", "layout");
  redirect(withMsg(back, "ok", `${name} added. Give them the username “${username}” and the password you set.`));
}

export async function createTeacher(fd: FormData) {
  await requireRole("admin");
  const back = "/admin/people";
  const name = str(fd, "name"), username = str(fd, "username").toLowerCase(), password = str(fd, "password");
  if (!name) redirect(withMsg(back, "err", "Fill in the teacher's name."));
  checkLogin(username, password, back);
  const subjects = fd.getAll("subjects").map(Number).filter(Boolean);
  const err = await sql.begin(async (tx) => {
    const id = await insertUser(tx, name, username, password, "teacher");
    if (!id) return `The username “${username}” is already taken.`;
    for (const sub of subjects) await tx`insert into teacher_subjects (teacher_id, subject_id) values (${id}, ${sub})`;
    return null;
  });
  if (err) redirect(withMsg(back, "err", err));
  revalidatePath("/", "layout");
  redirect(withMsg(back, "ok", `${name} added as a teacher.`));
}

export async function createParent(fd: FormData) {
  await requireRole("admin");
  const back = "/admin/people";
  const name = str(fd, "name"), username = str(fd, "username").toLowerCase(), password = str(fd, "password");
  if (!name) redirect(withMsg(back, "err", "Fill in the parent's name."));
  checkLogin(username, password, back);
  const id = await sql.begin((tx) => insertUser(tx, name, username, password, "parent"));
  if (!id) redirect(withMsg(back, "err", `The username “${username}” is already taken.`));
  revalidatePath("/", "layout");
  redirect(withMsg(back, "ok", `${name} added. Link them to their child from the child's login page.`));
}

export async function updateUser(fd: FormData) {
  const s = await requireRole("admin");
  const id = int(fd, "id");
  const [u] = id ? await sql`select id, role from users where id = ${id}` : [];
  if (!u) redirect("/admin/people");
  const back = `/admin/people/${u.id}`;
  const name = str(fd, "name");
  if (!name) redirect(withMsg(back, "err", "Name can't be empty."));
  const active = u.id === s.uid ? true : fd.has("active");
  await sql.begin(async (tx) => {
    // Deactivating someone also signs them out.
    await tx`update users set name = ${name}, active = ${active},
      session_version = session_version + ${active ? 0 : 1} where id = ${u.id}`;
    if (u.role === "student") {
      const batchId = int(fd, "batch_id");
      if (batchId) {
        await tx`update students set batch_id = ${batchId}, parent_id = ${int(fd, "parent_id")} where user_id = ${u.id}`;
        await tx`insert into sheet_students (sheet_id, student_id) select id, ${u.id} from sheets where batch_id = ${batchId} on conflict do nothing`;
      }
    }
    if (u.role === "teacher" || u.role === "admin") {
      await tx`delete from teacher_subjects where teacher_id = ${u.id}`;
      for (const sub of fd.getAll("subjects").map(Number).filter(Boolean))
        await tx`insert into teacher_subjects (teacher_id, subject_id) values (${u.id}, ${sub})`;
    }
  });
  revalidatePath("/", "layout");
  redirect(withMsg(back, "ok", "Saved."));
}

export async function resetPassword(fd: FormData) {
  const s = await requireRole("admin");
  const id = int(fd, "id");
  const back = `/admin/people/${id}`;
  const password = str(fd, "password");
  if (password.length < 6) redirect(withMsg(back, "err", "Password must be at least 6 characters."));
  await sql`update users set password_hash = ${await bcrypt.hash(password, 10)}, session_version = session_version + 1 where id = ${id}`;
  // Changing your own password signs you out too; send admin back to login.
  if (id === s.uid) redirect("/logout");
  redirect(withMsg(back, "ok", "Password changed. They have been signed out and must use the new password."));
}

export async function postNotice(fd: FormData) {
  const s = await requireRole("admin");
  const body = str(fd, "body");
  const target = str(fd, "target");
  if (!body) redirect(withMsg("/admin/notices", "err", "Write the notice first."));
  const [kind, raw] = target.split(":");
  const tid = Number(raw) || null;
  await sql`insert into notices (author_id, batch_id, student_id, body)
    values (${s.uid}, ${kind === "batch" ? tid : null}, ${kind === "student" ? tid : null}, ${body})`;
  revalidatePath("/", "layout");
  redirect(withMsg("/admin/notices", "ok", "Notice posted."));
}

export async function deleteNotice(fd: FormData) {
  await requireRole("admin");
  await sql`delete from notices where id = ${int(fd, "id")}`;
  revalidatePath("/", "layout");
  redirect(withMsg("/admin/notices", "ok", "Notice deleted."));
}

export async function addBehaviourNote(fd: FormData) {
  const s = await requireRole("admin");
  const studentId = int(fd, "student_id");
  const back = `/students/${studentId}`;
  const note = str(fd, "note");
  if (!studentId || !note) redirect(withMsg(back, "err", "Write what you noticed first.") + "#behaviour");
  await sql`insert into behaviour_notes (student_id, author_id, note, advice) values (${studentId}, ${s.uid}, ${note}, ${str(fd, "advice")})`;
  revalidatePath(`/students/${studentId}`);
  redirect(withMsg(back, "ok", "Behaviour note saved. Only you can see it.") + "#behaviour");
}

export async function deleteBehaviourNote(fd: FormData) {
  await requireRole("admin");
  const [n] = await sql`delete from behaviour_notes where id = ${int(fd, "id")} returning student_id`;
  if (n) revalidatePath(`/students/${n.student_id}`);
  redirect(n ? `/students/${n.student_id}#behaviour` : "/admin");
}
