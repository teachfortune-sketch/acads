import { requireRole } from "@/lib/auth";
import { getStudent } from "@/lib/queries";
import { Shell } from "@/components/Shell";
import { Flash } from "@/components/Flash";
import { Classes, Overview, Progress } from "@/components/StudentViews";
import { QuestHome } from "@/components/Quest";

const TITLES: Record<string, string> = { today: "Notes & tasks", progress: "My progress", classes: "All classes" };

export default async function MePage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const s = await requireRole("student");
  const sp = await searchParams;
  const tab = sp.tab && sp.tab in TITLES ? sp.tab : null;
  const st = await getStudent(s.uid);
  if (!st) return <Shell s={s} active="/me"><p>Your student profile is not set up yet. Please tell Rahul.</p></Shell>;
  return (
    <Shell s={s} active={tab ? `/me?tab=${tab}` : "/me"}>
      <div>
        <h1>{tab ? TITLES[tab] : `Hi ${st.name.split(" ")[0]}`}</h1>
        <p className="muted">{st.batch}</p>
      </div>
      <Flash sp={sp} />
      {tab === "progress" ? <Progress st={st} /> : tab === "classes" ? <Classes st={st} /> : tab === "today" ? <Overview st={st} /> : <QuestHome st={st} viewer="student" />}
    </Shell>
  );
}
