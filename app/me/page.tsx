import { requireRole } from "@/lib/auth";
import { getStudent } from "@/lib/queries";
import { Shell } from "@/components/Shell";
import { Classes, Overview, Progress } from "@/components/StudentViews";

export default async function MePage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const s = await requireRole("student");
  const { tab } = await searchParams;
  const st = await getStudent(s.uid);
  if (!st) return <Shell s={s} active="/me"><p>Your student profile is not set up yet. Please tell Rahul.</p></Shell>;
  const active = tab === "progress" || tab === "classes" ? `/me?tab=${tab}` : "/me";
  return (
    <Shell s={s} active={active}>
      <div>
        <h1>{tab === "progress" ? "My progress" : tab === "classes" ? "All classes" : `Hi ${st.name.split(" ")[0]}`}</h1>
        <p className="muted">{st.batch}</p>
      </div>
      {tab === "progress" ? <Progress st={st} /> : tab === "classes" ? <Classes st={st} /> : <Overview st={st} />}
    </Shell>
  );
}
