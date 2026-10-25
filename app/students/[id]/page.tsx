import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole, TEACHING } from "@/lib/auth";
import { getStudent } from "@/lib/queries";
import { Shell } from "@/components/Shell";
import { Classes, Overview, Progress } from "@/components/StudentViews";

// Full profile for admin and teachers.
export default async function StudentPage({ params }: { params: Promise<{ id: string }> }) {
  const s = await requireRole(...TEACHING);
  const st = await getStudent(Number((await params).id));
  if (!st) notFound();
  return (
    <Shell s={s} active={s.role === "admin" ? "/admin" : "/teach"}>
      <div className="row-actions">
        <Link href={s.role === "admin" ? `/admin?batch=${st.batch_id}` : "/teach"} className="btn small">← Back</Link>
        {s.role === "admin" && <Link href={`/admin/people/${st.id}`} className="btn small">Edit login</Link>}
      </div>
      <div>
        <h1>{st.name}</h1>
        <p className="muted">{st.batch} · username {st.username}{st.parent ? ` · parent: ${st.parent}` : ""}</p>
      </div>
      <Overview st={st} forParent />
      <h2>Progress</h2>
      <Progress st={st} />
      <h2>All classes</h2>
      <Classes st={st} />
    </Shell>
  );
}
