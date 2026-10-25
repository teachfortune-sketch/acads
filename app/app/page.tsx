import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { withMsg } from "@/lib/util";

const HOME = { admin: "/admin", teacher: "/class", reception: "/desk", student: "/me", parent: "/parent" } as const;

export default async function Home({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const s = await requireRole();
  const { ok } = await searchParams;
  redirect(ok ? withMsg(HOME[s.role], "ok", ok) : HOME[s.role]);
}
