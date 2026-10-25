import { requireRole } from "@/lib/auth";
import { viewedBatch } from "@/lib/viewer";
import { batchBoard } from "@/lib/points";
import { Shell } from "@/components/Shell";
import { BatchChips } from "@/components/BatchChips";
import { Leaderboard } from "@/components/Quest";
import { AutoRefresh } from "@/components/AutoRefresh";

// Students see their own class; parents their child's; staff pick a batch.
export default async function BoardPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const s = await requireRole();
  const sp = await searchParams;
  const { batches, batch, me, child, staff } = await viewedBatch(s, sp);
  const batchId = batch?.id ?? null;
  const board = batchId ? await batchBoard(batchId) : [];
  return (
    <Shell s={s} active="/board" child={child}>
      <AutoRefresh seconds={10} />
      <div>
        <h1>Leaderboard{batch ? `: ${batch.name}` : ""}</h1>
        <p className="muted">Ranked by net XP this term. Ties go to fewer deductions. ▲▼ shows today&apos;s movement.</p>
      </div>
      {staff && <BatchChips batches={batches} current={batchId} base="/board" />}
      <Leaderboard board={board} me={me} />
    </Shell>
  );
}
