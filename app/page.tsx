import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";

export default async function Home() {
  const s = await requireRole();
  redirect({ admin: "/admin", teacher: "/teach", student: "/me", parent: "/parent" }[s.role]);
}
