import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { sql } from "@/lib/db";
import { getStudent } from "@/lib/queries";
import { Shell } from "@/components/Shell";
import { Classes, Overview, Progress } from "@/components/StudentViews";

export default async function ParentPage({ searchParams }: { searchParams: Promise<{ tab?: string; child?: string }> }) {
  const s = await requireRole("parent");
  const { tab, child } = await searchParams;
  const children = await sql<{ id: number; name: string }[]>`
    select u.id, u.name from students st join users u on u.id = st.user_id where st.parent_id = ${s.uid} order by u.name`;
  const active = tab === "progress" || tab === "classes" ? `/parent?tab=${tab}` : "/parent";
  if (!children.length)
    return <Shell s={s} active={active}><p>No child is linked to your login yet. Please tell Rahul.</p></Shell>;
  const chosen = children.find((c) => c.id === Number(child)) ?? children[0];
  const st = (await getStudent(chosen.id))!;
  return (
    <Shell s={s} active={active} child={chosen.id}>
      <div>
        <h1>{st.name}</h1>
        <p className="muted">{st.batch}</p>
      </div>
      {children.length > 1 && (
        <div className="chips">
          {children.map((c) => (
            <Link key={c.id} href={`/parent?child=${c.id}${tab ? `&tab=${tab}` : ""}`} aria-current={c.id === chosen.id}>
              {c.name}
            </Link>
          ))}
        </div>
      )}
      {tab === "progress" ? <Progress st={st} /> : tab === "classes" ? <Classes st={st} /> : <Overview st={st} forParent />}
    </Shell>
  );
}
