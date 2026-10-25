"use server";
import { randomBytes } from "node:crypto";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { sql } from "@/lib/db";
import { int, str, withMsg } from "@/lib/util";

const back = "/admin/display";

export async function createDisplayLink(fd: FormData) {
  const s = await requireRole("admin");
  const label = str(fd, "label").slice(0, 60) || "TV";
  const batch = int(fd, "batch_id") || null;
  await sql`insert into display_links (token, label, batch_id, created_by) values (${randomBytes(18).toString("base64url")}, ${label}, ${batch}, ${s.uid})`;
  redirect(withMsg(back, "ok", "Link made. Open it on the TV's browser and leave it running."));
}

export async function revokeDisplayLink(fd: FormData) {
  await requireRole("admin");
  await sql`update display_links set revoked_at = now() where id = ${int(fd, "id") ?? 0} and revoked_at is null`;
  redirect(withMsg(back, "ok", "Link turned off. Any TV using it stops updating."));
}
