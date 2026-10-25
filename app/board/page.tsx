import { requireRole } from "@/lib/auth";
import { sql } from "@/lib/db";
import { getBatches, getStudent } from "@/lib/queries";
import { batchBoard } from "@/lib/points";
import { Shell } from "@/components/Shell";
import { BatchChips } from "@/components/BatchChips";
import { Leaderboard } from "@/components/Quest";
import { AutoRefresh } from "@/components/AutoRefresh";

// Students see their own class; parents their child's; staff pick a batch.
export default async function BoardPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const s = await requireRole();
  const sp = await searchParams;
  const batches = await getBatches();
  let batchId: number | null = null, me: number | undefined, child: number | undefined;
  if (s.role === "student") {
    const st = await getStudent(s.uid);
    batchId = st?.batch_id ?? null;
    me = s.uid;
  } else if (s.role === "parent") {
    const kids = await sql`select st.user_id as id, st.batch_id from students st where st.parent_id = ${s.uid} order by st.user_id`;
    const k = kids.find((x) => x.id === Number(sp.child)) ?? kids[0];
    batchId = k?.batch_id ?? null;
    me = child = k?.id;
  } else {
    batchId = batches.find((b) => b.id === Number(sp.batch))?.id ?? batches[0]?.id ?? null;
  }
  const batch = batches.find((b) => b.id === batchId);
  const board = batchId ? await batchBoard(batchId) : [];
  return (
    <Shell s={s} active="/board" child={child}>
      <AutoRefresh seconds={10} />
      <div>
        <h1>Leaderboard{batch ? `: ${batch.name}` : ""}</h1>
        <p className="muted">Ranked by net XP this term. Ties go to fewer deductions. ▲▼ shows today&apos;s movement.</p>
      </div>
      {!["student", "parent"].includes(s.role) && <BatchChips batches={batches} current={batchId} base="/board" />}
      <Leaderboard board={board} me={me} />
    </Shell>
  );
}
